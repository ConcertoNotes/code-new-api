package model

import (
	"errors"
	"sort"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
)

// 降智检测：用同一道 HTML 动画题对比不同分组/渠道/模型/思考强度的实际输出质量。
const (
	QualityTestConcurrency = 3
	QualityTestTimeout     = 10 * time.Minute
	// 运行中的任务每隔几秒写一次心跳；超过该时长没有心跳即视为所在进程已退出
	qualityTestStaleAfter = 30 * time.Second

	QualityTestStatusRunning     = "running"
	QualityTestStatusCancelling  = "cancelling"
	QualityTestStatusCompleted   = "completed"
	QualityTestStatusError       = "error"
	QualityTestStatusStopped     = "stopped"
	QualityTestStatusInterrupted = "interrupted"
)

var qualityTestActiveStatuses = []string{QualityTestStatusRunning, QualityTestStatusCancelling}

var (
	ErrQualityTestCapacity    = errors.New("最多同时运行 3 个检测任务，请等待一个任务完成")
	ErrQualityTestChannelBusy = errors.New("该渠道已有进行中的检测任务")
)

// QualityTestJob 一次检测记录。渠道名称、分组、预设名称都是快照，改名或删除渠道不会改写历史。
type QualityTestJob struct {
	Id              int    `json:"id"`
	ChannelId       int    `json:"channel_id" gorm:"index"`
	ChannelName     string `json:"channel_name" gorm:"type:varchar(255)"`
	ChannelType     int    `json:"channel_type"`
	ChannelGroup    string `json:"group" gorm:"type:varchar(64);index"`
	Model           string `json:"model" gorm:"type:varchar(255);index"`
	ReasoningEffort string `json:"reasoning_effort" gorm:"type:varchar(32)"`
	EndpointType    string `json:"endpoint_type" gorm:"type:varchar(64)"`
	Prompt          string `json:"prompt,omitempty"`
	// PresetKind 为 builtin 时 PresetRef 是内置预设 key，为 custom 时是 quality_test_prompts 的 id，为空表示手写提示词
	PresetKind      string `json:"preset_kind" gorm:"type:varchar(16)"`
	PresetRef       string `json:"preset_ref" gorm:"type:varchar(64)"`
	PresetName      string `json:"preset_name" gorm:"type:varchar(128)"`
	Status          string `json:"status" gorm:"type:varchar(16);index"`
	Output          string `json:"output,omitempty"`
	Error           string `json:"error,omitempty" gorm:"type:text"`
	ResponseModel   string `json:"response_model,omitempty" gorm:"type:varchar(255)"`
	DurationMs      int64  `json:"duration_ms"`
	FirstContentMs  *int64 `json:"first_content_ms,omitempty"`
	InputTokens     *int   `json:"input_tokens,omitempty"`
	OutputTokens    *int   `json:"output_tokens,omitempty"`
	ReasoningTokens *int   `json:"reasoning_tokens,omitempty"`
	CreatedAt       int64  `json:"created_at" gorm:"index"`
	UpdatedAt       int64  `json:"updated_at"`
	CompletedAt     int64  `json:"completed_at,omitempty"`
	DeadlineAt      int64  `json:"-"`
}

// QualityTestPrompt 可复用的提示词预设；内置预设随前端发布，不入库。
type QualityTestPrompt struct {
	Id         int    `json:"id"`
	Name       string `json:"name" gorm:"type:varchar(128)"`
	Prompt     string `json:"prompt"`
	UsageCount int    `json:"usage_count"`
	LastUsedAt int64  `json:"last_used_at,omitempty"`
	CreatedAt  int64  `json:"created_at"`
	UpdatedAt  int64  `json:"updated_at" gorm:"index"`
}

// QualityTestFilter 检测记录筛选；HasEffort 表示显式筛选思考强度（含模型默认值 ""），
// HasPreset 且 PresetKind 为空表示筛选手写提示词。
type QualityTestFilter struct {
	ChannelId       int
	Group           string
	Model           string
	ReasoningEffort string
	HasEffort       bool
	HasPreset       bool
	PresetKind      string
	PresetRef       string
}

type QualityTestChannelFacet struct {
	Id   int    `json:"id"`
	Name string `json:"name"`
}

type QualityTestPresetFacet struct {
	Kind string `json:"kind"`
	Ref  string `json:"ref"`
	Name string `json:"name"`
}

// QualityTestFacets 列出全表的去重取值（不受当前筛选影响），保证筛选菜单稳定
type QualityTestFacets struct {
	Groups   []string                  `json:"groups"`
	Models   []string                  `json:"models"`
	Efforts  []string                  `json:"efforts"`
	Channels []QualityTestChannelFacet `json:"channels"`
	Presets  []QualityTestPresetFacet  `json:"presets"`
}

type QualityTestPage struct {
	Jobs       []QualityTestJob  `json:"jobs"`
	ActiveJobs []QualityTestJob  `json:"active_jobs"`
	Total      int64             `json:"total"`
	Limit      int               `json:"concurrency_limit"`
	Facets     QualityTestFacets `json:"facets"`
}

// 准入在进程内串行化，保证并发上限与"同一渠道仅一个任务"不被并发请求绕过
var qualityTestAdmission sync.Mutex

// ExpireQualityTests 把失去心跳或超过硬截止时间的任务标记为中断，避免进程崩溃后永久占用名额。
func ExpireQualityTests(now time.Time) error {
	return DB.Model(&QualityTestJob{}).
		Where("status IN ? AND (updated_at < ? OR deadline_at < ?)", qualityTestActiveStatuses,
			now.Add(-qualityTestStaleAfter).Unix(), now.Add(-time.Minute).Unix()).
		Updates(map[string]any{
			"status":       QualityTestStatusInterrupted,
			"error":        "检测进程已退出，任务中断",
			"completed_at": now.Unix(),
			"updated_at":   now.Unix(),
		}).Error
}

// CreateQualityTestJob 在并发名额内创建运行中的检测任务。
func CreateQualityTestJob(job *QualityTestJob) error {
	qualityTestAdmission.Lock()
	defer qualityTestAdmission.Unlock()

	now := time.Now()
	if err := ExpireQualityTests(now); err != nil {
		return err
	}
	var active []QualityTestJob
	if err := DB.Select("id", "channel_id").Where("status IN ?", qualityTestActiveStatuses).Find(&active).Error; err != nil {
		return err
	}
	for _, item := range active {
		if item.ChannelId == job.ChannelId {
			return ErrQualityTestChannelBusy
		}
	}
	if len(active) >= QualityTestConcurrency {
		return ErrQualityTestCapacity
	}
	job.Id = 0
	job.Status = QualityTestStatusRunning
	job.CreatedAt = now.Unix()
	job.UpdatedAt = now.Unix()
	job.DeadlineAt = now.Add(QualityTestTimeout).Unix()
	return DB.Create(job).Error
}

func GetQualityTestJob(id int) (*QualityTestJob, error) {
	var job QualityTestJob
	if err := DB.First(&job, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &job, nil
}

func GetQualityTestStatus(id int) (string, error) {
	var job QualityTestJob
	if err := DB.Select("status").First(&job, "id = ?", id).Error; err != nil {
		return "", err
	}
	return job.Status, nil
}

// SaveQualityTestProgress 只在任务仍处于运行态时写入进度，同时刷新心跳
func SaveQualityTestProgress(job *QualityTestJob) error {
	return DB.Model(&QualityTestJob{}).
		Where("id = ? AND status IN ?", job.Id, qualityTestActiveStatuses).
		Updates(map[string]any{
			"output":           job.Output,
			"response_model":   job.ResponseModel,
			"first_content_ms": job.FirstContentMs,
			"input_tokens":     job.InputTokens,
			"output_tokens":    job.OutputTokens,
			"reasoning_tokens": job.ReasoningTokens,
			"duration_ms":      job.DurationMs,
			"updated_at":       time.Now().Unix(),
		}).Error
}

func FinishQualityTest(job *QualityTestJob) error {
	now := time.Now().Unix()
	return DB.Model(&QualityTestJob{}).Where("id = ?", job.Id).Updates(map[string]any{
		"status":           job.Status,
		"output":           job.Output,
		"error":            job.Error,
		"response_model":   job.ResponseModel,
		"first_content_ms": job.FirstContentMs,
		"input_tokens":     job.InputTokens,
		"output_tokens":    job.OutputTokens,
		"reasoning_tokens": job.ReasoningTokens,
		"duration_ms":      job.DurationMs,
		"completed_at":     now,
		"updated_at":       now,
	}).Error
}

// CancelQualityTest 请求停止；执行进程轮询到 cancelling 后中止上游请求
func CancelQualityTest(id int) error {
	return DB.Model(&QualityTestJob{}).
		Where("id = ? AND status = ?", id, QualityTestStatusRunning).
		Updates(map[string]any{"status": QualityTestStatusCancelling, "updated_at": time.Now().Unix()}).Error
}

func (f QualityTestFilter) apply(tx *gorm.DB) *gorm.DB {
	if f.ChannelId > 0 {
		tx = tx.Where("channel_id = ?", f.ChannelId)
	}
	if f.Group != "" {
		tx = tx.Where("channel_group = ?", f.Group)
	}
	if f.Model != "" {
		tx = tx.Where("model = ?", f.Model)
	}
	if f.HasEffort {
		tx = tx.Where("reasoning_effort = ?", f.ReasoningEffort)
	}
	if f.HasPreset {
		tx = tx.Where("preset_kind = ?", f.PresetKind)
		if f.PresetKind != "" {
			tx = tx.Where("preset_ref = ?", f.PresetRef)
		}
	}
	return tx
}

// 列表不返回大字段，详情接口再取输出与提示词
var qualityTestListOmit = []string{"output", "prompt"}

func ListQualityTests(page, pageSize int, filter QualityTestFilter) (*QualityTestPage, error) {
	if err := ExpireQualityTests(time.Now()); err != nil {
		return nil, err
	}
	result := &QualityTestPage{Jobs: []QualityTestJob{}, ActiveJobs: []QualityTestJob{}, Limit: QualityTestConcurrency}
	if err := filter.apply(DB.Model(&QualityTestJob{})).Count(&result.Total).Error; err != nil {
		return nil, err
	}
	if err := filter.apply(DB.Omit(qualityTestListOmit...)).Order("id desc").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&result.Jobs).Error; err != nil {
		return nil, err
	}
	if err := DB.Omit(qualityTestListOmit...).Where("status IN ?", qualityTestActiveStatuses).
		Order("id asc").Find(&result.ActiveJobs).Error; err != nil {
		return nil, err
	}
	facets, err := getQualityTestFacets()
	if err != nil {
		return nil, err
	}
	result.Facets = *facets
	return result, nil
}

func getQualityTestFacets() (*QualityTestFacets, error) {
	facets := &QualityTestFacets{Groups: []string{}, Models: []string{}, Efforts: []string{}, Channels: []QualityTestChannelFacet{}, Presets: []QualityTestPresetFacet{}}
	if err := DB.Model(&QualityTestJob{}).Distinct().Order("channel_group").Pluck("channel_group", &facets.Groups).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&QualityTestJob{}).Distinct().Order("model").Pluck("model", &facets.Models).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&QualityTestJob{}).Distinct().Order("reasoning_effort").Pluck("reasoning_effort", &facets.Efforts).Error; err != nil {
		return nil, err
	}

	// 同一渠道/预设可能在不同时期有不同的名称快照，取最新一条
	var channels []QualityTestJob
	if err := DB.Select("channel_id", "channel_name").Order("id desc").
		Where("id IN (?)", DB.Model(&QualityTestJob{}).Select("MAX(id)").Group("channel_id")).
		Find(&channels).Error; err != nil {
		return nil, err
	}
	for _, item := range channels {
		facets.Channels = append(facets.Channels, QualityTestChannelFacet{Id: item.ChannelId, Name: item.ChannelName})
	}
	sort.Slice(facets.Channels, func(i, j int) bool { return facets.Channels[i].Id < facets.Channels[j].Id })

	var presets []QualityTestJob
	if err := DB.Select("preset_kind", "preset_ref", "preset_name").Order("id desc").
		Where("preset_kind <> ''").
		Where("id IN (?)", DB.Model(&QualityTestJob{}).Select("MAX(id)").Group("preset_kind, preset_ref")).
		Find(&presets).Error; err != nil {
		return nil, err
	}
	for _, item := range presets {
		facets.Presets = append(facets.Presets, QualityTestPresetFacet{Kind: item.PresetKind, Ref: item.PresetRef, Name: item.PresetName})
	}
	sort.Slice(facets.Presets, func(i, j int) bool {
		if facets.Presets[i].Kind != facets.Presets[j].Kind {
			return facets.Presets[i].Kind < facets.Presets[j].Kind
		}
		return strings.Compare(facets.Presets[i].Name, facets.Presets[j].Name) < 0
	})
	return facets, nil
}

// GetQualityTestChannels 返回检测可选的渠道（含已禁用渠道，便于排查），只取组装选项所需的列
func GetQualityTestChannels() ([]*Channel, error) {
	var channels []*Channel
	err := DB.Select("id, name, type, status, " + commonGroupCol + ", models, test_model").
		Order("id asc").Find(&channels).Error
	return channels, err
}

func ListQualityTestPrompts() ([]QualityTestPrompt, error) {
	prompts := make([]QualityTestPrompt, 0)
	err := DB.Order("updated_at desc").Order("id desc").Find(&prompts).Error
	return prompts, err
}

func GetQualityTestPrompt(id int) (*QualityTestPrompt, error) {
	var prompt QualityTestPrompt
	if err := DB.First(&prompt, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &prompt, nil
}

func CreateQualityTestPrompt(prompt *QualityTestPrompt) error {
	now := time.Now().Unix()
	prompt.Id = 0
	prompt.UsageCount = 0
	prompt.CreatedAt = now
	prompt.UpdatedAt = now
	return DB.Create(prompt).Error
}

func UpdateQualityTestPrompt(id int, name, prompt string) error {
	return DB.Model(&QualityTestPrompt{}).Where("id = ?", id).Updates(map[string]any{
		"name":       name,
		"prompt":     prompt,
		"updated_at": time.Now().Unix(),
	}).Error
}

func DeleteQualityTestPrompt(id int) error {
	return DB.Delete(&QualityTestPrompt{}, "id = ?", id).Error
}

func IncrementQualityTestPromptUsage(id int) error {
	return DB.Model(&QualityTestPrompt{}).Where("id = ?", id).Updates(map[string]any{
		"usage_count":  gorm.Expr("usage_count + 1"),
		"last_used_at": time.Now().Unix(),
	}).Error
}
