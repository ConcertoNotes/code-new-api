package common

import (
	"bytes"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

const (
	// upstreamAuditHeadLimit 上游响应体头部采样上限。模型名 / service_tier 等字段
	// 几乎总出现在响应最前面（OpenAI / Claude 首帧、Responses response.created）。
	upstreamAuditHeadLimit = 64 << 10
	// upstreamAuditTailLimit 上游响应体尾部采样上限。Gemini 的 modelVersion、
	// 各协议的 finish_reason / stop_reason 通常位于响应末尾。
	upstreamAuditTailLimit = 16 << 10
	// upstreamAuditMaxFieldLength 采样字段的最大长度，防止异常上游把超长字符串写入日志。
	upstreamAuditMaxFieldLength = 200
)

// UpstreamResponseAudit 记录单次上游 HTTP 往返的诊断事实（端点、状态码、协议、
// 耗时、体积、限流头以及从响应体采样得到的模型名 / 结束原因等）。
// 它只用于管理员日志展示，绝不参与转发或计费逻辑。每次尝试（含重试）都会重建。
type UpstreamResponseAudit struct {
	Endpoint         string
	Method           string
	StatusCode       int
	Proto            string
	ContentType      string
	RequestBodyBytes int64
	RateLimitHeaders map[string]string
	ProcessingMs     int64

	startedAt  time.Time
	headersAt  time.Time
	finishedAt time.Time

	mu                sync.Mutex
	responseBodyBytes int64
	head              []byte
	tail              []byte
}

// UpstreamResponseSummary 是从响应体采样中解析出的结构化摘要。
type UpstreamResponseSummary struct {
	// Model 上游响应声明的模型名（OpenAI model / Claude message.model / Gemini modelVersion）。
	Model string
	// ModelConflict 同一响应内出现了多个互不相同的模型声明。
	ModelConflict bool
	// FinishReason 上游声明的结束原因（finish_reason / stop_reason / finishReason / response.status）。
	FinishReason string
	// ServiceTier 上游声明的服务层级（OpenAI service_tier / Anthropic usage.speed）。
	ServiceTier string
}

// upstreamAuditRateLimitHeaderPrefixes 需要采样的上游限流响应头前缀（小写）。
var upstreamAuditRateLimitHeaderPrefixes = []string{
	"x-ratelimit-",
	"anthropic-ratelimit-",
	"retry-after",
}

// NewUpstreamResponseAudit 在请求发出前创建审计对象并记录起始时间。
func NewUpstreamResponseAudit(req *http.Request) *UpstreamResponseAudit {
	audit := &UpstreamResponseAudit{startedAt: time.Now()}
	if req == nil {
		return audit
	}
	audit.Method = req.Method
	audit.RequestBodyBytes = req.ContentLength
	if req.URL != nil {
		audit.Endpoint = sanitizeUpstreamEndpoint(req.URL)
	}
	return audit
}

// sanitizeUpstreamEndpoint 只保留 scheme://host/path，丢弃 query（Gemini 等把密钥放在 query 中）。
func sanitizeUpstreamEndpoint(u *url.URL) string {
	if u == nil {
		return ""
	}
	clean := url.URL{Scheme: u.Scheme, Host: u.Host, Path: u.Path}
	return clean.String()
}

// ObserveResponse 记录响应头到达时刻与头部信息，并用采样 reader 包装响应体。
func (a *UpstreamResponseAudit) ObserveResponse(resp *http.Response) {
	if a == nil || resp == nil {
		return
	}
	a.headersAt = time.Now()
	a.StatusCode = resp.StatusCode
	a.Proto = resp.Proto
	a.ContentType = resp.Header.Get("Content-Type")
	if ms, err := strconv.ParseInt(strings.TrimSpace(resp.Header.Get("openai-processing-ms")), 10, 64); err == nil && ms >= 0 {
		a.ProcessingMs = ms
	}
	for name, values := range resp.Header {
		lower := strings.ToLower(name)
		matched := false
		for _, prefix := range upstreamAuditRateLimitHeaderPrefixes {
			if strings.HasPrefix(lower, prefix) {
				matched = true
				break
			}
		}
		if !matched || len(values) == 0 {
			continue
		}
		if a.RateLimitHeaders == nil {
			a.RateLimitHeaders = make(map[string]string)
		}
		a.RateLimitHeaders[lower] = truncateUpstreamAuditField(values[0])
	}
	if resp.Body != nil {
		resp.Body = &upstreamAuditBody{ReadCloser: resp.Body, audit: a}
	}
}

// upstreamAuditBody 透明包装上游响应体：统计字节数并保留头尾采样。
type upstreamAuditBody struct {
	io.ReadCloser
	audit *UpstreamResponseAudit
}

func (b *upstreamAuditBody) Read(p []byte) (int, error) {
	n, err := b.ReadCloser.Read(p)
	if n > 0 {
		b.audit.observeBytes(p[:n])
	}
	if err == io.EOF {
		b.audit.markFinished()
	}
	return n, err
}

func (b *upstreamAuditBody) Close() error {
	b.audit.markFinished()
	return b.ReadCloser.Close()
}

func (a *UpstreamResponseAudit) observeBytes(chunk []byte) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.responseBodyBytes += int64(len(chunk))
	if remain := upstreamAuditHeadLimit - len(a.head); remain > 0 {
		if len(chunk) <= remain {
			a.head = append(a.head, chunk...)
		} else {
			a.head = append(a.head, chunk[:remain]...)
		}
	}
	if len(chunk) >= upstreamAuditTailLimit {
		a.tail = append(a.tail[:0], chunk[len(chunk)-upstreamAuditTailLimit:]...)
		return
	}
	a.tail = append(a.tail, chunk...)
	if overflow := len(a.tail) - upstreamAuditTailLimit; overflow > 0 {
		a.tail = append(a.tail[:0], a.tail[overflow:]...)
	}
}

func (a *UpstreamResponseAudit) markFinished() {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.finishedAt.IsZero() {
		a.finishedAt = time.Now()
	}
}

// TTFBMs 从发出请求到收到响应头的毫秒数。
func (a *UpstreamResponseAudit) TTFBMs() int64 {
	if a == nil || a.headersAt.IsZero() {
		return 0
	}
	return a.headersAt.Sub(a.startedAt).Milliseconds()
}

// DurationMs 从发出请求到响应体读完/关闭的毫秒数；尚未结束时按当前时间计算。
func (a *UpstreamResponseAudit) DurationMs() int64 {
	if a == nil {
		return 0
	}
	a.mu.Lock()
	end := a.finishedAt
	a.mu.Unlock()
	if end.IsZero() {
		end = time.Now()
	}
	return end.Sub(a.startedAt).Milliseconds()
}

// ResponseBodyBytes 已经从上游读取的响应体字节数。
func (a *UpstreamResponseAudit) ResponseBodyBytes() int64 {
	if a == nil {
		return 0
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.responseBodyBytes
}

// Summary 解析响应体采样，提取模型名、结束原因与服务层级。
func (a *UpstreamResponseAudit) Summary() UpstreamResponseSummary {
	if a == nil {
		return UpstreamResponseSummary{}
	}
	a.mu.Lock()
	head := append([]byte(nil), a.head...)
	tail := append([]byte(nil), a.tail...)
	total := a.responseBodyBytes
	a.mu.Unlock()

	truncated := total > int64(len(head))
	if !truncated {
		tail = nil
	}
	if isUpstreamAuditSSE(a.ContentType, head) {
		return summarizeUpstreamSSE(head, tail)
	}
	return summarizeUpstreamJSON(head, tail, truncated)
}

func isUpstreamAuditSSE(contentType string, head []byte) bool {
	if strings.Contains(strings.ToLower(contentType), "text/event-stream") {
		return true
	}
	trimmed := bytes.TrimLeft(head, " \t\r\n")
	return bytes.HasPrefix(trimmed, []byte("data:")) || bytes.HasPrefix(trimmed, []byte("event:"))
}

// upstreamModelPaths / upstreamFinishPaths / upstreamTierPaths 各协议字段路径，按优先级排列。
var (
	upstreamModelPaths  = []string{"model", "response.model", "message.model", "modelVersion", "response.modelVersion"}
	upstreamFinishPaths = []string{"choices.0.finish_reason", "candidates.0.finishReason", "delta.stop_reason", "stop_reason", "response.status", "response.incomplete_details.reason"}
	upstreamTierPaths   = []string{"service_tier", "response.service_tier", "message.usage.speed", "usage.speed"}
)

func firstGJSONString(payload []byte, paths ...string) string {
	for _, path := range paths {
		value := gjson.GetBytes(payload, path)
		if value.Type != gjson.String {
			continue
		}
		if text := strings.TrimSpace(value.String()); text != "" {
			return truncateUpstreamAuditField(text)
		}
	}
	return ""
}

func isUpstreamTerminalEvent(eventType string) bool {
	switch strings.TrimSpace(eventType) {
	case "response.completed", "response.done", "response.failed", "response.incomplete", "response.cancelled", "response.canceled":
		return true
	default:
		return false
	}
}

func summarizeUpstreamSSE(head, tail []byte) UpstreamResponseSummary {
	var summary UpstreamResponseSummary
	var firstModel, terminalModel string
	observe := func(payload []byte, eventType string) {
		if !gjson.ValidBytes(payload) {
			return
		}
		if model := firstGJSONString(payload, upstreamModelPaths...); model != "" {
			current := terminalModel
			if current == "" {
				current = firstModel
			}
			if current != "" && !strings.EqualFold(current, model) {
				summary.ModelConflict = true
			}
			if isUpstreamTerminalEvent(eventType) {
				terminalModel = model
			} else if firstModel == "" {
				firstModel = model
			}
		}
		if finish := firstGJSONString(payload, upstreamFinishPaths...); finish != "" {
			summary.FinishReason = finish
		}
		if tier := firstGJSONString(payload, upstreamTierPaths...); tier != "" {
			summary.ServiceTier = tier
		}
	}
	forEachUpstreamSSEFrame(head, false, observe)
	forEachUpstreamSSEFrame(tail, true, observe)
	summary.Model = terminalModel
	if summary.Model == "" {
		summary.Model = firstModel
	}
	return summary
}

// forEachUpstreamSSEFrame 遍历采样中的 data 行。skipFirstLine 用于尾部采样：
// 首行大概率是被截断的半行，直接丢弃。
func forEachUpstreamSSEFrame(buf []byte, skipFirstLine bool, fn func(payload []byte, eventType string)) {
	if len(buf) == 0 {
		return
	}
	if skipFirstLine {
		idx := bytes.IndexByte(buf, '\n')
		if idx < 0 {
			return
		}
		buf = buf[idx+1:]
	}
	eventType := ""
	for _, rawLine := range bytes.Split(buf, []byte("\n")) {
		line := bytes.TrimRight(rawLine, "\r")
		switch {
		case bytes.HasPrefix(line, []byte("event:")):
			eventType = strings.TrimSpace(string(line[len("event:"):]))
		case bytes.HasPrefix(line, []byte("data:")):
			payload := bytes.TrimSpace(line[len("data:"):])
			if len(payload) == 0 || bytes.Equal(payload, []byte("[DONE]")) {
				continue
			}
			payloadEvent := eventType
			if inline := gjson.GetBytes(payload, "type"); inline.Type == gjson.String && payloadEvent == "" {
				payloadEvent = inline.String()
			}
			fn(payload, payloadEvent)
		case len(line) == 0:
			eventType = ""
		}
	}
}

func summarizeUpstreamJSON(head, tail []byte, truncated bool) UpstreamResponseSummary {
	if !truncated && gjson.ValidBytes(head) {
		return UpstreamResponseSummary{
			Model:        firstGJSONString(head, upstreamModelPaths...),
			FinishReason: firstGJSONString(head, upstreamFinishPaths...),
			ServiceTier:  firstGJSONString(head, upstreamTierPaths...),
		}
	}
	// 响应体超过采样上限时无法整体解析，退化为在头尾采样中扫描已知字段名。
	summary := UpstreamResponseSummary{}
	for _, key := range []string{"model", "modelVersion"} {
		if summary.Model = scanQuotedStringField(head, key); summary.Model != "" {
			break
		}
		if summary.Model = scanQuotedStringField(tail, key); summary.Model != "" {
			break
		}
	}
	for _, key := range []string{"finish_reason", "finishReason", "stop_reason"} {
		if summary.FinishReason = scanQuotedStringField(tail, key); summary.FinishReason != "" {
			break
		}
		if summary.FinishReason = scanQuotedStringField(head, key); summary.FinishReason != "" {
			break
		}
	}
	summary.ServiceTier = scanQuotedStringField(head, "service_tier")
	return summary
}

// scanQuotedStringField 在任意（可能不完整的）JSON 片段中查找 "key": "value" 并返回 value。
func scanQuotedStringField(buf []byte, key string) string {
	needle := []byte(`"` + key + `"`)
	offset := 0
	for {
		idx := bytes.Index(buf[offset:], needle)
		if idx < 0 {
			return ""
		}
		pos := offset + idx + len(needle)
		offset = pos
		rest := bytes.TrimLeft(buf[pos:], " \t\r\n")
		if len(rest) == 0 || rest[0] != ':' {
			continue
		}
		rest = bytes.TrimLeft(rest[1:], " \t\r\n")
		if len(rest) == 0 || rest[0] != '"' {
			continue
		}
		rest = rest[1:]
		var value strings.Builder
		escaped := false
		for _, ch := range rest {
			if escaped {
				value.WriteByte(ch)
				escaped = false
				continue
			}
			if ch == '\\' {
				escaped = true
				continue
			}
			if ch == '"' {
				return truncateUpstreamAuditField(strings.TrimSpace(value.String()))
			}
			value.WriteByte(ch)
		}
		return ""
	}
}

func truncateUpstreamAuditField(value string) string {
	runes := []rune(value)
	if len(runes) > upstreamAuditMaxFieldLength {
		return string(runes[:upstreamAuditMaxFieldLength])
	}
	return value
}

// AdminInfo 生成写入日志 admin_info.upstream 的结构化视图；summary 由调用方通过 Summary() 解析一次后传入。
func (a *UpstreamResponseAudit) AdminInfo(summary UpstreamResponseSummary) map[string]any {
	if a == nil {
		return nil
	}
	info := map[string]any{
		"endpoint":    a.Endpoint,
		"method":      a.Method,
		"duration_ms": a.DurationMs(),
	}
	// 请求在收到响应头前就失败（连接被拒、超时等）时没有状态码与响应体，
	// 只保留端点与耗时，避免把 0 当成真实状态码写入日志。
	if !a.headersAt.IsZero() {
		info["status_code"] = a.StatusCode
		info["proto"] = a.Proto
		info["ttfb_ms"] = a.TTFBMs()
		info["response_bytes"] = a.ResponseBodyBytes()
	}
	if a.ContentType != "" {
		info["content_type"] = truncateUpstreamAuditField(a.ContentType)
	}
	if a.RequestBodyBytes > 0 {
		info["request_bytes"] = a.RequestBodyBytes
	}
	if a.ProcessingMs > 0 {
		info["processing_ms"] = a.ProcessingMs
	}
	if len(a.RateLimitHeaders) > 0 {
		info["ratelimit"] = a.RateLimitHeaders
	}
	if summary.FinishReason != "" {
		info["finish_reason"] = summary.FinishReason
	}
	if summary.ServiceTier != "" {
		info["service_tier"] = summary.ServiceTier
	}
	return info
}

// SetUpstreamResponseAudit 把当前尝试的审计对象挂到请求上下文；传 nil 表示清空（每次尝试开始时）。
func SetUpstreamResponseAudit(c *gin.Context, audit *UpstreamResponseAudit) {
	if c == nil {
		return
	}
	c.Set(string(constant.ContextKeyUpstreamResponseAudit), audit)
}

// GetUpstreamResponseAudit 读取当前尝试的审计对象，不存在时返回 nil。
func GetUpstreamResponseAudit(c *gin.Context) *UpstreamResponseAudit {
	if c == nil {
		return nil
	}
	audit, ok := common.GetContextKeyType[*UpstreamResponseAudit](c, constant.ContextKeyUpstreamResponseAudit)
	if !ok {
		return nil
	}
	return audit
}

// UpstreamModelsMatchForAudit 判断发往上游的模型名与上游响应声明的模型名是否一致（忽略大小写与首尾空白）。
func UpstreamModelsMatchForAudit(sentModel, responseModel string) bool {
	return strings.EqualFold(strings.TrimSpace(sentModel), strings.TrimSpace(responseModel))
}
