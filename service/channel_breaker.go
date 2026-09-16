package service

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// 渠道熔断状态
const (
	ChannelBreakerStateClosed   = "closed"    // 正常
	ChannelBreakerStateOpen     = "open"      // 冷却中，选路时跳过
	ChannelBreakerStateHalfOpen = "half_open" // 冷却结束，放行探测请求
)

// 半开状态下一个探测请求最长占用探测名额的时间，超过后允许下一个探测，
// 避免探测请求因意外没有上报结果而永远卡住恢复流程。
const channelBreakerProbeTimeout = 60 * time.Second

type channelBreakerState struct {
	failures    int       // 窗口内连续失败次数
	lastFailure time.Time // 最近一次失败时间
	openUntil   time.Time // 冷却截止时间；零值表示未熔断
	trips       int       // 连续熔断次数，用于指数退避
	probeUntil  time.Time // 半开探测请求占用名额的截止时间
}

var (
	channelBreakerLock   sync.Mutex
	channelBreakerStates = make(map[int]*channelBreakerState)
	// 可注入的时钟，便于测试冷却到期与半开探测
	channelBreakerNow = time.Now
)

func (s *channelBreakerState) stateAt(now time.Time) string {
	if s == nil || s.openUntil.IsZero() {
		return ChannelBreakerStateClosed
	}
	if now.Before(s.openUntil) {
		return ChannelBreakerStateOpen
	}
	return ChannelBreakerStateHalfOpen
}

// 半开状态下若已有探测请求在途，其他请求继续跳过该渠道
func (s *channelBreakerState) shouldSkipAt(now time.Time) bool {
	switch s.stateAt(now) {
	case ChannelBreakerStateOpen:
		return true
	case ChannelBreakerStateHalfOpen:
		return now.Before(s.probeUntil)
	default:
		return false
	}
}

// ChannelBreakerFilter 返回当前应跳过的渠道过滤器；没有渠道处于冷却时返回 nil。
func ChannelBreakerFilter() *dto.ChannelFilter {
	if !operation_setting.GetChannelBreakerSetting().Enabled {
		return nil
	}
	now := channelBreakerNow()
	channelBreakerLock.Lock()
	defer channelBreakerLock.Unlock()
	var skipped map[int]struct{}
	for id, state := range channelBreakerStates {
		if !state.shouldSkipAt(now) {
			continue
		}
		if skipped == nil {
			skipped = make(map[int]struct{})
		}
		skipped[id] = struct{}{}
	}
	if len(skipped) == 0 {
		return nil
	}
	return &dto.ChannelFilter{Kind: dto.FilterChannelBreaker, ExcludedChannelIDs: skipped}
}

// MarkChannelBreakerProbe 在半开渠道被选中时占用探测名额，
// 使其他并发请求在探测结果出来前继续走备用渠道。
func MarkChannelBreakerProbe(channelId int) {
	now := channelBreakerNow()
	channelBreakerLock.Lock()
	defer channelBreakerLock.Unlock()
	state, ok := channelBreakerStates[channelId]
	if !ok || state.stateAt(now) != ChannelBreakerStateHalfOpen {
		return
	}
	state.probeUntil = now.Add(channelBreakerProbeTimeout)
}

// IsChannelBreakerFailure 判断一次请求错误是否应计入渠道故障。
// 客户端参数错误、鉴权问题（由自动禁用处理）、本地转换失败等不计入。
func IsChannelBreakerFailure(err *types.NewAPIError) bool {
	if err == nil {
		return false
	}
	if errors.Is(err.Err, context.Canceled) {
		return false
	}
	if types.IsChannelError(err) {
		return true
	}
	if err.GetErrorCode() == types.ErrorCodeDoRequestFailed {
		return true
	}
	if types.IsSkipRetryError(err) {
		return false
	}
	if err.StatusCode < 100 || err.StatusCode > 599 {
		return true
	}
	return operation_setting.ChannelBreakerMatchesStatusCode(err.StatusCode)
}

// ReportChannelBreakerResult 上报一次请求在某渠道上的结果，驱动熔断状态机。
func ReportChannelBreakerResult(channelId int, channelName string, err *types.NewAPIError) {
	setting := operation_setting.GetChannelBreakerSetting()
	if !setting.Enabled || channelId <= 0 {
		return
	}
	if err == nil {
		reportChannelBreakerSuccess(channelId, channelName)
		return
	}
	if !IsChannelBreakerFailure(err) {
		return
	}
	reportChannelBreakerFailure(channelId, channelName, setting, err)
}

func reportChannelBreakerSuccess(channelId int, channelName string) {
	channelBreakerLock.Lock()
	state, ok := channelBreakerStates[channelId]
	if !ok {
		channelBreakerLock.Unlock()
		return
	}
	wasTripped := !state.openUntil.IsZero()
	delete(channelBreakerStates, channelId)
	channelBreakerLock.Unlock()
	if wasTripped {
		common.SysLog(fmt.Sprintf("渠道「%s」（#%d）探测成功，已恢复正常并重新参与选路", channelName, channelId))
	}
}

func reportChannelBreakerFailure(channelId int, channelName string, setting operation_setting.ChannelBreakerSetting, err *types.NewAPIError) {
	now := channelBreakerNow()
	window := time.Duration(setting.FailureWindowSeconds) * time.Second

	channelBreakerLock.Lock()
	defer channelBreakerLock.Unlock()
	state, ok := channelBreakerStates[channelId]
	if !ok {
		state = &channelBreakerState{}
		channelBreakerStates[channelId] = state
	}

	// 半开探测失败：直接再次熔断并加倍冷却
	if state.stateAt(now) == ChannelBreakerStateHalfOpen {
		state.trips++
		state.failures = 0
		state.probeUntil = time.Time{}
		cooldown := channelBreakerCooldown(setting, state.trips)
		state.openUntil = now.Add(cooldown)
		common.SysLog(fmt.Sprintf("渠道「%s」（#%d）探测失败，继续冷却 %s（第 %d 次熔断）：%s", channelName, channelId, cooldown, state.trips, common.LocalLogPreview(err.ErrorWithStatusCode())))
		return
	}
	if state.stateAt(now) == ChannelBreakerStateOpen {
		// 冷却期间仍被使用（例如所有渠道都在冷却时的兜底放行），只刷新失败时间
		state.lastFailure = now
		return
	}

	if !state.lastFailure.IsZero() && now.Sub(state.lastFailure) > window {
		state.failures = 0
	}
	state.failures++
	state.lastFailure = now
	if state.failures < setting.FailureThreshold {
		return
	}

	state.trips++
	state.failures = 0
	cooldown := channelBreakerCooldown(setting, state.trips)
	state.openUntil = now.Add(cooldown)
	common.SysLog(fmt.Sprintf("渠道「%s」（#%d）连续失败 %d 次，已熔断冷却 %s，期间请求将自动切换到其他渠道：%s", channelName, channelId, setting.FailureThreshold, cooldown, common.LocalLogPreview(err.ErrorWithStatusCode())))
}

// 指数退避：第 n 次熔断冷却 base * 2^(n-1)，上限 MaxCooldownSeconds
func channelBreakerCooldown(setting operation_setting.ChannelBreakerSetting, trips int) time.Duration {
	base := time.Duration(setting.CooldownSeconds) * time.Second
	maxCooldown := time.Duration(setting.MaxCooldownSeconds) * time.Second
	cooldown := base
	for i := 1; i < trips; i++ {
		cooldown *= 2
		if cooldown >= maxCooldown {
			return maxCooldown
		}
	}
	if cooldown > maxCooldown {
		return maxCooldown
	}
	return cooldown
}

// ResetChannelBreaker 手动清除某个渠道的熔断状态（渠道被编辑/启用时调用）。
func ResetChannelBreaker(channelId int) {
	channelBreakerLock.Lock()
	defer channelBreakerLock.Unlock()
	delete(channelBreakerStates, channelId)
}

// GetChannelBreakerSnapshot 返回单个渠道的熔断快照，正常状态返回 nil。
func GetChannelBreakerSnapshot(channelId int) *dto.ChannelBreakerSnapshot {
	now := channelBreakerNow()
	channelBreakerLock.Lock()
	defer channelBreakerLock.Unlock()
	state, ok := channelBreakerStates[channelId]
	if !ok {
		return nil
	}
	return state.snapshot(channelId, now)
}

// ListChannelBreakerSnapshots 返回所有有记录的渠道熔断快照。
func ListChannelBreakerSnapshots() []dto.ChannelBreakerSnapshot {
	now := channelBreakerNow()
	channelBreakerLock.Lock()
	defer channelBreakerLock.Unlock()
	result := make([]dto.ChannelBreakerSnapshot, 0, len(channelBreakerStates))
	for id, state := range channelBreakerStates {
		result = append(result, *state.snapshot(id, now))
	}
	return result
}

func (s *channelBreakerState) snapshot(channelId int, now time.Time) *dto.ChannelBreakerSnapshot {
	snapshot := &dto.ChannelBreakerSnapshot{
		ChannelId: channelId,
		State:     s.stateAt(now),
		Failures:  s.failures,
		Trips:     s.trips,
	}
	if !s.openUntil.IsZero() {
		snapshot.OpenUntil = s.openUntil.Unix()
	}
	if now.Before(s.probeUntil) {
		snapshot.ProbeUntil = s.probeUntil.Unix()
	}
	return snapshot
}

// IsChannelBreakerSkipping 判断某个渠道当前是否应被选路跳过（冷却中或探测占用中）。
func IsChannelBreakerSkipping(channelId int) bool {
	if !operation_setting.GetChannelBreakerSetting().Enabled {
		return false
	}
	now := channelBreakerNow()
	channelBreakerLock.Lock()
	defer channelBreakerLock.Unlock()
	state, ok := channelBreakerStates[channelId]
	return ok && state.shouldSkipAt(now)
}
