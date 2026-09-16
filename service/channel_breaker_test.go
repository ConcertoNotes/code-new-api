package service

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupChannelBreakerTest 固定熔断配置与时钟，并隔离全局状态；返回可推进的当前时间指针。
func setupChannelBreakerTest(t *testing.T) *time.Time {
	t.Helper()
	cfg := config.GlobalConfig.Get("channel_breaker_setting").(*operation_setting.ChannelBreakerSetting)
	previous := *cfg
	*cfg = operation_setting.ChannelBreakerSetting{
		Enabled:              true,
		FailureThreshold:     3,
		FailureWindowSeconds: 60,
		CooldownSeconds:      30,
		MaxCooldownSeconds:   120,
		StatusCodes:          "408,429,500-599",
	}
	now := time.Date(2026, 9, 16, 12, 0, 0, 0, time.UTC)
	previousNow := channelBreakerNow
	channelBreakerNow = func() time.Time { return now }
	channelBreakerLock.Lock()
	previousStates := channelBreakerStates
	channelBreakerStates = make(map[int]*channelBreakerState)
	channelBreakerLock.Unlock()
	t.Cleanup(func() {
		*cfg = previous
		channelBreakerNow = previousNow
		channelBreakerLock.Lock()
		channelBreakerStates = previousStates
		channelBreakerLock.Unlock()
	})
	return &now
}

func upstreamError(status int) *types.NewAPIError {
	return types.NewOpenAIError(errors.New("upstream failed"), types.ErrorCodeBadResponseStatusCode, status)
}

func breakerSkips(channelId int) bool {
	filter := ChannelBreakerFilter()
	if filter == nil {
		return false
	}
	_, skipped := filter.ExcludedChannelIDs[channelId]
	return skipped
}

func TestChannelBreakerTripsAfterConsecutiveFailures(t *testing.T) {
	setupChannelBreakerTest(t)

	ReportChannelBreakerResult(1, "primary", upstreamError(http.StatusBadGateway))
	ReportChannelBreakerResult(1, "primary", upstreamError(http.StatusBadGateway))
	assert.False(t, breakerSkips(1), "below threshold must not trip")

	ReportChannelBreakerResult(1, "primary", upstreamError(http.StatusBadGateway))
	assert.True(t, breakerSkips(1), "third consecutive failure trips the breaker")

	snapshot := GetChannelBreakerSnapshot(1)
	require.NotNil(t, snapshot)
	assert.Equal(t, ChannelBreakerStateOpen, snapshot.State)
	assert.Equal(t, 1, snapshot.Trips)
	assert.Equal(t, dto.FilterChannelBreaker, ChannelBreakerFilter().Kind)
}

func TestChannelBreakerSuccessResetsFailureCount(t *testing.T) {
	setupChannelBreakerTest(t)

	ReportChannelBreakerResult(1, "primary", upstreamError(http.StatusBadGateway))
	ReportChannelBreakerResult(1, "primary", upstreamError(http.StatusBadGateway))
	ReportChannelBreakerResult(1, "primary", nil)
	ReportChannelBreakerResult(1, "primary", upstreamError(http.StatusBadGateway))
	ReportChannelBreakerResult(1, "primary", upstreamError(http.StatusBadGateway))

	assert.False(t, breakerSkips(1), "a success in between restarts the consecutive failure count")
	snapshot := GetChannelBreakerSnapshot(1)
	require.NotNil(t, snapshot)
	assert.Equal(t, ChannelBreakerStateClosed, snapshot.State)
	assert.Equal(t, 2, snapshot.Failures)
}

func TestChannelBreakerFailureWindowExpiryResetsCount(t *testing.T) {
	now := setupChannelBreakerTest(t)

	ReportChannelBreakerResult(1, "primary", upstreamError(http.StatusBadGateway))
	ReportChannelBreakerResult(1, "primary", upstreamError(http.StatusBadGateway))
	*now = now.Add(61 * time.Second)
	ReportChannelBreakerResult(1, "primary", upstreamError(http.StatusBadGateway))

	assert.False(t, breakerSkips(1), "failures outside the window must not accumulate")
}

func TestChannelBreakerHalfOpenProbeRecoversOnSuccess(t *testing.T) {
	now := setupChannelBreakerTest(t)
	for i := 0; i < 3; i++ {
		ReportChannelBreakerResult(1, "primary", upstreamError(http.StatusServiceUnavailable))
	}
	require.True(t, breakerSkips(1))

	*now = now.Add(31 * time.Second)
	assert.False(t, breakerSkips(1), "cooldown expired: half-open lets a probe through")
	assert.Equal(t, ChannelBreakerStateHalfOpen, GetChannelBreakerSnapshot(1).State)

	MarkChannelBreakerProbe(1)
	assert.True(t, breakerSkips(1), "while a probe is in flight other requests keep avoiding the channel")

	ReportChannelBreakerResult(1, "primary", nil)
	assert.False(t, breakerSkips(1))
	assert.Nil(t, GetChannelBreakerSnapshot(1), "successful probe fully closes the breaker")
}

func TestChannelBreakerHalfOpenProbeFailureBacksOffExponentially(t *testing.T) {
	now := setupChannelBreakerTest(t)
	for i := 0; i < 3; i++ {
		ReportChannelBreakerResult(1, "primary", upstreamError(http.StatusServiceUnavailable))
	}
	assert.Equal(t, now.Add(30*time.Second).Unix(), GetChannelBreakerSnapshot(1).OpenUntil)

	*now = now.Add(31 * time.Second)
	MarkChannelBreakerProbe(1)
	ReportChannelBreakerResult(1, "primary", upstreamError(http.StatusServiceUnavailable))

	snapshot := GetChannelBreakerSnapshot(1)
	require.NotNil(t, snapshot)
	assert.Equal(t, ChannelBreakerStateOpen, snapshot.State)
	assert.Equal(t, 2, snapshot.Trips)
	assert.Equal(t, now.Add(60*time.Second).Unix(), snapshot.OpenUntil, "second trip doubles the cooldown")
	assert.True(t, breakerSkips(1))

	*now = now.Add(61 * time.Second)
	MarkChannelBreakerProbe(1)
	ReportChannelBreakerResult(1, "primary", upstreamError(http.StatusServiceUnavailable))
	assert.Equal(t, now.Add(120*time.Second).Unix(), GetChannelBreakerSnapshot(1).OpenUntil)

	*now = now.Add(121 * time.Second)
	MarkChannelBreakerProbe(1)
	ReportChannelBreakerResult(1, "primary", upstreamError(http.StatusServiceUnavailable))
	assert.Equal(t, now.Add(120*time.Second).Unix(), GetChannelBreakerSnapshot(1).OpenUntil, "cooldown is capped at max_cooldown_seconds")
}

func TestChannelBreakerProbeSlotExpires(t *testing.T) {
	now := setupChannelBreakerTest(t)
	for i := 0; i < 3; i++ {
		ReportChannelBreakerResult(1, "primary", upstreamError(http.StatusServiceUnavailable))
	}
	*now = now.Add(31 * time.Second)
	MarkChannelBreakerProbe(1)
	require.True(t, breakerSkips(1))

	*now = now.Add(channelBreakerProbeTimeout + time.Second)
	assert.False(t, breakerSkips(1), "a probe that never reported must not block recovery forever")
}

func TestChannelBreakerDisabledSettingIsNoop(t *testing.T) {
	setupChannelBreakerTest(t)
	cfg := config.GlobalConfig.Get("channel_breaker_setting").(*operation_setting.ChannelBreakerSetting)
	cfg.Enabled = false

	for i := 0; i < 5; i++ {
		ReportChannelBreakerResult(1, "primary", upstreamError(http.StatusBadGateway))
	}
	assert.Nil(t, ChannelBreakerFilter())
	assert.False(t, IsChannelBreakerSkipping(1))
}

func TestChannelBreakerResetClearsState(t *testing.T) {
	setupChannelBreakerTest(t)
	for i := 0; i < 3; i++ {
		ReportChannelBreakerResult(1, "primary", upstreamError(http.StatusBadGateway))
	}
	require.True(t, breakerSkips(1))

	ResetChannelBreaker(1)
	assert.False(t, breakerSkips(1))
	assert.Nil(t, GetChannelBreakerSnapshot(1))
}

func TestIsChannelBreakerFailure(t *testing.T) {
	setupChannelBreakerTest(t)

	tests := []struct {
		name string
		err  *types.NewAPIError
		want bool
	}{
		{name: "nil error", err: nil, want: false},
		{name: "5xx counts", err: upstreamError(http.StatusBadGateway), want: true},
		{name: "429 counts", err: upstreamError(http.StatusTooManyRequests), want: true},
		{name: "408 counts", err: upstreamError(http.StatusRequestTimeout), want: true},
		{name: "400 is the client fault", err: upstreamError(http.StatusBadRequest), want: false},
		{name: "401 is left to auto-disable", err: upstreamError(http.StatusUnauthorized), want: false},
		{name: "404 does not count", err: upstreamError(http.StatusNotFound), want: false},
		{name: "connection failure counts", err: types.NewError(errors.New("dial tcp: connection refused"), types.ErrorCodeDoRequestFailed), want: true},
		{name: "client cancellation does not count", err: types.NewError(context.Canceled, types.ErrorCodeDoRequestFailed), want: false},
		{name: "channel-scoped error counts", err: types.NewError(errors.New("no key"), types.ErrorCodeChannelNoAvailableKey), want: true},
		{name: "skip-retry local error does not count", err: types.NewError(errors.New("convert failed"), types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry()), want: false},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			assert.Equal(t, testCase.want, IsChannelBreakerFailure(testCase.err))
		})
	}
}
