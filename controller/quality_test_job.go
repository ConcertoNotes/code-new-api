package controller

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/tidwall/gjson"
	"gorm.io/gorm"
)

const (
	qualityTestPromptLimit     = 16000
	qualityTestPromptNameLimit = 100
	qualityTestOutputLimit     = 1 << 20
	qualityTestInstructions    = "Return a complete, self-contained HTML document for the user's request. Include all SVG, CSS and JavaScript inline. Do not use external resources. Return only HTML, without Markdown fences or explanations."
)

// 各端点可选的思考强度；"" 表示不传，由模型默认值决定
var qualityTestEfforts = map[string][]string{
	string(constant.EndpointTypeOpenAI):         {"", "none", "minimal", "low", "medium", "high", "xhigh"},
	string(constant.EndpointTypeOpenAIResponse): {"", "none", "minimal", "low", "medium", "high", "xhigh"},
	string(constant.EndpointTypeAnthropic):      {"", "low", "medium", "high", "max"},
}

var qualityTestBuiltinPresetKey = regexp.MustCompile(`^[a-z0-9_-]{1,64}$`)

// 预览页是独立文档：带独立 CSP 并以 sandbox 方式运行模型生成的代码，
// 不继承后台页面的权限；父页面通过 postMessage 注入 HTML。
const qualityTestPreviewHTML = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
addEventListener('message', function receive(event) {
  if (event.source !== parent || !event.data || event.data.type !== 'quality-test-preview' || typeof event.data.html !== 'string' || event.data.html.length > 1100000) return;
  removeEventListener('message', receive);
  document.open();
  document.write(event.data.html);
  document.close();
});
</script></body></html>`

func ServeQualityTestPreview(c *gin.Context) {
	c.Header("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts")
	c.Header("X-Frame-Options", "SAMEORIGIN")
	c.Header("Referrer-Policy", "no-referrer")
	c.Header("Cache-Control", "no-store")
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(qualityTestPreviewHTML))
}

type qualityTestChannelOption struct {
	Id              int      `json:"id"`
	Name            string   `json:"name"`
	Type            int      `json:"type"`
	Status          int      `json:"status"`
	Models          []string `json:"models"`
	DefaultEndpoint string   `json:"default_endpoint"`
}

type qualityTestGroupOption struct {
	Name     string                     `json:"name"`
	Channels []qualityTestChannelOption `json:"channels"`
}

// qualityTestDefaultEndpoint 按渠道类型选择原生协议，其他渠道走 OpenAI Chat 兼容格式
func qualityTestDefaultEndpoint(channelType int) string {
	switch channelType {
	case constant.ChannelTypeCodex:
		return string(constant.EndpointTypeOpenAIResponse)
	case constant.ChannelTypeAnthropic:
		return string(constant.EndpointTypeAnthropic)
	default:
		return string(constant.EndpointTypeOpenAI)
	}
}

func qualityTestChannelModels(channel *model.Channel) []string {
	models := make([]string, 0)
	for _, item := range channel.GetModels() {
		item = strings.TrimSpace(item)
		if item != "" && !slices.Contains(models, item) {
			models = append(models, item)
		}
	}
	if channel.TestModel != nil {
		if testModel := strings.TrimSpace(*channel.TestModel); testModel != "" && !slices.Contains(models, testModel) {
			models = append([]string{testModel}, models...)
		}
	}
	return models
}

// GetQualityTestOptions 返回 分组 → 渠道 → 模型 的级联选项
func GetQualityTestOptions(c *gin.Context) {
	channels, err := model.GetQualityTestChannels()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	groups := map[string]*qualityTestGroupOption{}
	for _, channel := range channels {
		option := qualityTestChannelOption{
			Id:              channel.Id,
			Name:            channel.Name,
			Type:            channel.Type,
			Status:          channel.Status,
			Models:          qualityTestChannelModels(channel),
			DefaultEndpoint: qualityTestDefaultEndpoint(channel.Type),
		}
		for _, group := range channel.GetGroups() {
			if group == "" {
				continue
			}
			if groups[group] == nil {
				groups[group] = &qualityTestGroupOption{Name: group, Channels: []qualityTestChannelOption{}}
			}
			groups[group].Channels = append(groups[group].Channels, option)
		}
	}
	result := make([]qualityTestGroupOption, 0, len(groups))
	for _, group := range groups {
		result = append(result, *group)
	}
	sort.Slice(result, func(i, j int) bool {
		if (result[i].Name == "default") != (result[j].Name == "default") {
			return result[i].Name == "default"
		}
		return result[i].Name < result[j].Name
	})
	common.ApiSuccess(c, gin.H{
		"groups":            result,
		"reasoning_efforts": qualityTestEfforts,
		"concurrency_limit": model.QualityTestConcurrency,
	})
}

type qualityTestRequest struct {
	ChannelId       int    `json:"channel_id"`
	Group           string `json:"group"`
	Model           string `json:"model"`
	ReasoningEffort string `json:"reasoning_effort"`
	EndpointType    string `json:"endpoint_type"`
	Prompt          string `json:"prompt"`
	// PromptId 指向自定义预设；PresetKey 指向内置预设，PresetName 为内置预设的展示名快照
	PromptId   int    `json:"prompt_id,omitempty"`
	PresetKey  string `json:"preset_key,omitempty"`
	PresetName string `json:"preset_name,omitempty"`
}

// buildQualityTestRequest 按端点构造流式生成请求
func buildQualityTestRequest(endpointType, modelName, prompt, effort string) (dto.Request, error) {
	switch constant.EndpointType(endpointType) {
	case constant.EndpointTypeOpenAIResponse:
		instructions, err := common.Marshal(qualityTestInstructions)
		if err != nil {
			return nil, err
		}
		input, err := common.Marshal([]map[string]any{{
			"role":    "user",
			"content": []map[string]any{{"type": "input_text", "text": prompt}},
		}})
		if err != nil {
			return nil, err
		}
		request := &dto.OpenAIResponsesRequest{
			Model:        modelName,
			Stream:       lo.ToPtr(true),
			Instructions: instructions,
			Input:        input,
		}
		if effort != "" {
			request.Reasoning = &dto.Reasoning{Effort: effort}
		}
		return request, nil
	case constant.EndpointTypeAnthropic:
		request := &dto.ClaudeRequest{
			Model:     modelName,
			Stream:    lo.ToPtr(true),
			MaxTokens: lo.ToPtr(uint(32000)),
			System:    qualityTestInstructions,
			Messages:  []dto.ClaudeMessage{{Role: "user", Content: prompt}},
		}
		if effort != "" {
			outputConfig, err := common.Marshal(map[string]string{"effort": effort})
			if err != nil {
				return nil, err
			}
			request.Thinking = &dto.Thinking{Type: "adaptive"}
			request.OutputConfig = outputConfig
		}
		return request, nil
	default:
		return &dto.GeneralOpenAIRequest{
			Model:         modelName,
			Stream:        lo.ToPtr(true),
			StreamOptions: &dto.StreamOptions{IncludeUsage: true},
			Messages: []dto.Message{
				{Role: "system", Content: qualityTestInstructions},
				{Role: "user", Content: prompt},
			},
			ReasoningEffort: effort,
		}, nil
	}
}

// resolveQualityTestPreset 记录本次提示词来源；自定义预设以数据库中的名称为准，
// 预设已被删除或内容已改动时视为手写提示词。
func resolveQualityTestPreset(req qualityTestRequest) (kind, ref, name string) {
	if req.PromptId > 0 {
		preset, err := model.GetQualityTestPrompt(req.PromptId)
		if err != nil || preset.Prompt != req.Prompt {
			return "", "", ""
		}
		return "custom", strconv.Itoa(preset.Id), preset.Name
	}
	key := strings.ToLower(strings.TrimSpace(req.PresetKey))
	if !qualityTestBuiltinPresetKey.MatchString(key) {
		return "", "", ""
	}
	name = strings.TrimSpace(req.PresetName)
	if utf8.RuneCountInString(name) > qualityTestPromptNameLimit {
		name = string([]rune(name)[:qualityTestPromptNameLimit])
	}
	return "builtin", key, name
}

func CreateQualityTestJob(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 128*1024)
	var req qualityTestRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "无效的检测请求")
		return
	}
	req.Group = strings.TrimSpace(req.Group)
	req.Model = strings.TrimSpace(req.Model)
	req.ReasoningEffort = strings.ToLower(strings.TrimSpace(req.ReasoningEffort))
	req.EndpointType = strings.TrimSpace(req.EndpointType)
	if req.Model == "" || len(req.Model) > 200 || strings.TrimSpace(req.Prompt) == "" || len(req.Prompt) > qualityTestPromptLimit {
		common.ApiErrorMsg(c, "请选择模型，测试提示词不能为空且不能超过 16000 字节")
		return
	}
	channel, err := model.GetChannelById(req.ChannelId, true)
	if err != nil {
		common.ApiErrorMsg(c, "渠道不存在")
		return
	}
	if req.Group == "" || !slices.Contains(channel.GetGroups(), req.Group) {
		common.ApiErrorMsg(c, "该渠道不属于所选分组")
		return
	}
	if !slices.Contains(qualityTestChannelModels(channel), req.Model) {
		common.ApiErrorMsg(c, fmt.Sprintf("该渠道不支持测试模型: %s", req.Model))
		return
	}
	if req.EndpointType == "" {
		req.EndpointType = qualityTestDefaultEndpoint(channel.Type)
	}
	efforts, ok := qualityTestEfforts[req.EndpointType]
	if !ok {
		common.ApiErrorMsg(c, "不支持的请求端点")
		return
	}
	if !slices.Contains(efforts, req.ReasoningEffort) {
		common.ApiErrorMsg(c, "该端点不支持所选思考强度")
		return
	}
	testUserID, err := resolveChannelTestUserID(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	request, err := buildQualityTestRequest(req.EndpointType, req.Model, req.Prompt, req.ReasoningEffort)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	presetKind, presetRef, presetName := resolveQualityTestPreset(req)
	job := &model.QualityTestJob{
		ChannelId:       channel.Id,
		ChannelName:     channel.Name,
		ChannelType:     channel.Type,
		ChannelGroup:    req.Group,
		Model:           req.Model,
		ReasoningEffort: req.ReasoningEffort,
		EndpointType:    req.EndpointType,
		Prompt:          req.Prompt,
		PresetKind:      presetKind,
		PresetRef:       presetRef,
		PresetName:      presetName,
	}
	if err := model.CreateQualityTestJob(job); err != nil {
		if errors.Is(err, model.ErrQualityTestCapacity) || errors.Is(err, model.ErrQualityTestChannelBusy) {
			common.ApiErrorMsg(c, err.Error())
			return
		}
		common.ApiError(c, err)
		return
	}
	if presetKind == "custom" {
		if err := model.IncrementQualityTestPromptUsage(req.PromptId); err != nil {
			common.SysError(fmt.Sprintf("quality test job %d: failed to record preset %d usage: %v", job.Id, req.PromptId, err))
		}
	}
	// 任务在后台运行，离开页面不会中断；最终状态由执行协程写回
	go runQualityTestJob(*job, channel, testUserID, request)
	common.ApiSuccess(c, job)
}

// qualityTestStreamEvent 从一条 SSE data 中提取的增量信息
type qualityTestStreamEvent struct {
	Text            string
	Model           string
	InputTokens     *int
	OutputTokens    *int
	ReasoningTokens *int
	Error           string
}

func optionalGJSONInt(value gjson.Result) *int {
	if !value.Exists() || value.Type == gjson.Null {
		return nil
	}
	return lo.ToPtr(int(value.Int()))
}

// parseQualityTestStreamEvent 解析 OpenAI Chat / Responses / Anthropic Messages 三种流式格式
func parseQualityTestStreamEvent(data []byte) qualityTestStreamEvent {
	var event qualityTestStreamEvent
	if len(data) == 0 || bytes.Equal(data, []byte("[DONE]")) || !gjson.ValidBytes(data) {
		return event
	}
	root := gjson.ParseBytes(data)
	if root.Get("choices").Exists() || root.Get("object").String() == "chat.completion.chunk" {
		event.Text = root.Get("choices.0.delta.content").String()
		event.Model = root.Get("model").String()
		if usage := root.Get("usage"); usage.IsObject() {
			event.InputTokens = optionalGJSONInt(usage.Get("prompt_tokens"))
			event.OutputTokens = optionalGJSONInt(usage.Get("completion_tokens"))
			event.ReasoningTokens = optionalGJSONInt(usage.Get("completion_tokens_details.reasoning_tokens"))
		}
		return event
	}
	switch root.Get("type").String() {
	case "response.output_text.delta":
		event.Text = root.Get("delta").String()
	case "response.created", "response.in_progress":
		event.Model = root.Get("response.model").String()
	case "response.completed", "response.incomplete":
		response := root.Get("response")
		event.Model = response.Get("model").String()
		event.InputTokens = optionalGJSONInt(response.Get("usage.input_tokens"))
		event.OutputTokens = optionalGJSONInt(response.Get("usage.output_tokens"))
		event.ReasoningTokens = optionalGJSONInt(response.Get("usage.output_tokens_details.reasoning_tokens"))
	case "response.failed":
		event.Error = root.Get("response.error.message").String()
		if event.Error == "" {
			event.Error = "上游返回 response.failed"
		}
	case "message_start":
		event.Model = root.Get("message.model").String()
		event.InputTokens = optionalGJSONInt(root.Get("message.usage.input_tokens"))
	case "content_block_delta":
		if root.Get("delta.type").String() == "text_delta" {
			event.Text = root.Get("delta.text").String()
		}
	case "message_delta":
		event.OutputTokens = optionalGJSONInt(root.Get("usage.output_tokens"))
	case "error":
		event.Error = root.Get("error.message").String()
		if event.Error == "" {
			event.Error = root.Get("message").String()
		}
	}
	if event.Error == "" && root.Get("error").IsObject() {
		event.Error = root.Get("error.message").String()
	}
	return event
}

// qualityTestStreamWriter 接收渠道测试管线写出的 SSE，按行解析后回调；不持有任何客户端连接
type qualityTestStreamWriter struct {
	header  http.Header
	pending []byte
	onEvent func(qualityTestStreamEvent)
}

func (w *qualityTestStreamWriter) Header() http.Header { return w.header }
func (w *qualityTestStreamWriter) WriteHeader(int)     {}
func (w *qualityTestStreamWriter) Flush()              {}
func (w *qualityTestStreamWriter) Write(body []byte) (int, error) {
	w.pending = append(w.pending, body...)
	for {
		index := bytes.IndexByte(w.pending, '\n')
		if index < 0 {
			break
		}
		line := bytes.TrimSpace(w.pending[:index])
		w.pending = w.pending[index+1:]
		if data, ok := bytes.CutPrefix(line, []byte("data:")); ok {
			w.onEvent(parseQualityTestStreamEvent(bytes.TrimSpace(data)))
		}
	}
	return len(body), nil
}

func runQualityTestJob(job model.QualityTestJob, channel *model.Channel, testUserID int, request dto.Request) {
	ctx, cancel := context.WithDeadline(context.Background(), time.Unix(job.DeadlineAt, 0))
	defer cancel()
	started := time.Now()

	var mu sync.Mutex
	dirty, stopped := false, false
	streamErr := ""
	writer := &qualityTestStreamWriter{header: make(http.Header), onEvent: func(event qualityTestStreamEvent) {
		mu.Lock()
		defer mu.Unlock()
		if event.Text != "" {
			if len(job.Output)+len(event.Text) > qualityTestOutputLimit {
				streamErr = "输出超过 1 MiB 上限，已停止生成"
				cancel()
				return
			}
			job.Output += event.Text
			if job.FirstContentMs == nil {
				job.FirstContentMs = lo.ToPtr(time.Since(started).Milliseconds())
			}
		}
		if event.Model != "" {
			job.ResponseModel = event.Model
		}
		if event.InputTokens != nil {
			job.InputTokens = event.InputTokens
		}
		if event.OutputTokens != nil {
			job.OutputTokens = event.OutputTokens
		}
		if event.ReasoningTokens != nil {
			job.ReasoningTokens = event.ReasoningTokens
		}
		if event.Error != "" {
			streamErr = event.Error
		}
		dirty = true
	}}

	// 每秒检查一次停止请求并落盘进度；无新输出时每 5 秒写一次心跳
	done, watched := make(chan struct{}), make(chan struct{})
	go func() {
		defer close(watched)
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for tick := 1; ; tick++ {
			select {
			case <-done:
				return
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
			status, err := model.GetQualityTestStatus(job.Id)
			if err == nil && status != model.QualityTestStatusRunning {
				mu.Lock()
				stopped = true
				mu.Unlock()
				cancel()
				return
			}
			mu.Lock()
			changed := dirty || tick%5 == 0
			dirty = false
			job.DurationMs = time.Since(started).Milliseconds()
			snapshot := job
			mu.Unlock()
			if changed {
				if err := model.SaveQualityTestProgress(&snapshot); err != nil {
					common.SysError(fmt.Sprintf("quality test job %d: failed to save progress: %v", job.Id, err))
				}
			}
		}
	}()

	var result testResult
	func() {
		defer func() {
			if recovered := recover(); recovered != nil {
				common.SysError(fmt.Sprintf("quality test job %d panicked: %v", job.Id, recovered))
				result.localErr = errors.New("检测任务异常中断")
			}
		}()
		result = runChannelTest(ctx, channel, testUserID, job.Model, job.EndpointType, true, channelTestOptions{
			request:    request,
			writer:     writer,
			logContent: "降智检测",
		})
	}()
	close(done)
	<-watched

	mu.Lock()
	defer mu.Unlock()
	job.DurationMs = time.Since(started).Milliseconds()
	switch {
	case errors.Is(ctx.Err(), context.DeadlineExceeded):
		job.Status, job.Error = model.QualityTestStatusError, "检测超过 10 分钟，已停止"
	case stopped:
		job.Status = model.QualityTestStatusStopped
	case streamErr != "":
		job.Status, job.Error = model.QualityTestStatusError, streamErr
	case result.localErr != nil:
		job.Status, job.Error = model.QualityTestStatusError, result.localErr.Error()
	default:
		job.Status = model.QualityTestStatusCompleted
	}
	if err := model.FinishQualityTest(&job); err != nil {
		common.SysError(fmt.Sprintf("quality test job %d: failed to finalize: %v", job.Id, err))
	}
}

func ListQualityTests(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("p", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 20
	}
	filter := model.QualityTestFilter{
		Group: strings.TrimSpace(c.Query("group")),
		Model: strings.TrimSpace(c.Query("model")),
	}
	if channelId, err := strconv.Atoi(c.Query("channel_id")); err == nil && channelId > 0 {
		filter.ChannelId = channelId
	}
	// effort=default 表示筛选使用模型默认值（存储为空字符串）的记录
	if effort, ok := c.GetQuery("effort"); ok && strings.TrimSpace(effort) != "" {
		filter.HasEffort = true
		if effort = strings.ToLower(strings.TrimSpace(effort)); effort != "default" {
			filter.ReasoningEffort = effort
		}
	}
	// preset=none | builtin:<key> | custom:<id>
	if preset := strings.TrimSpace(c.Query("preset")); preset != "" {
		if kind, ref, found := strings.Cut(preset, ":"); found && (kind == "builtin" || kind == "custom") && ref != "" {
			filter.HasPreset, filter.PresetKind, filter.PresetRef = true, kind, ref
		} else if preset == "none" {
			filter.HasPreset = true
		}
	}
	result, err := model.ListQualityTests(page, pageSize, filter)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

func GetQualityTest(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的检测记录 ID")
		return
	}
	job, err := model.GetQualityTestJob(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorMsg(c, "检测记录不存在")
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, job)
}

func CancelQualityTest(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的检测记录 ID")
		return
	}
	if err := model.CancelQualityTest(id); err != nil {
		common.ApiError(c, err)
		return
	}
	GetQualityTest(c)
}

type qualityTestPromptPayload struct {
	Name   *string `json:"name"`
	Prompt *string `json:"prompt"`
}

// normalizeQualityTestPrompt 校验预设；名称留空时取提示词开头
func normalizeQualityTestPrompt(req qualityTestPromptPayload, existing *model.QualityTestPrompt) (name, prompt string, err error) {
	if existing != nil {
		name, prompt = existing.Name, existing.Prompt
	}
	if req.Prompt != nil {
		prompt = *req.Prompt
	}
	if req.Name != nil {
		name = strings.TrimSpace(*req.Name)
	}
	if strings.TrimSpace(prompt) == "" || len(prompt) > qualityTestPromptLimit {
		return "", "", errors.New("提示词不能为空且不能超过 16000 字节")
	}
	if name == "" {
		name = strings.TrimSpace(prompt)
		if utf8.RuneCountInString(name) > 24 {
			name = string([]rune(name)[:24])
		}
	}
	if utf8.RuneCountInString(name) > qualityTestPromptNameLimit {
		return "", "", errors.New("预设名称不能超过 100 个字符")
	}
	return name, prompt, nil
}

func ListQualityTestPrompts(c *gin.Context) {
	prompts, err := model.ListQualityTestPrompts()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, prompts)
}

func CreateQualityTestPrompt(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 128*1024)
	var req qualityTestPromptPayload
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "无效的预设请求")
		return
	}
	name, prompt, err := normalizeQualityTestPrompt(req, nil)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	item := &model.QualityTestPrompt{Name: name, Prompt: prompt}
	if err := model.CreateQualityTestPrompt(item); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, item)
}

func UpdateQualityTestPrompt(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的预设 ID")
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 128*1024)
	var req qualityTestPromptPayload
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "无效的预设请求")
		return
	}
	existing, err := model.GetQualityTestPrompt(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorMsg(c, "提示词预设不存在")
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	name, prompt, err := normalizeQualityTestPrompt(req, existing)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateQualityTestPrompt(id, name, prompt); err != nil {
		common.ApiError(c, err)
		return
	}
	item, err := model.GetQualityTestPrompt(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, item)
}

func DeleteQualityTestPrompt(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的预设 ID")
		return
	}
	if err := model.DeleteQualityTestPrompt(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
