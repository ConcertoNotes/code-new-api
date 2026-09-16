package operation_setting

import (
	"fmt"
	"strconv"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/setting/config"
)

// ChannelBreakerSetting 渠道熔断（自动冷却）配置。
//
// 当某个渠道在短时间内连续失败达到阈值时，该渠道会进入“冷却”状态，
// 在冷却期间选路时会自动跳过它，让请求直接落到下一优先级的渠道，
// 而不是每个请求都先在故障渠道上失败一次再重试。
// 冷却结束后放行一个探测请求（半开状态）：探测成功立即恢复，
// 探测失败则以指数退避延长冷却时间。
type ChannelBreakerSetting struct {
	Enabled              bool   `json:"enabled"`
	FailureThreshold     int    `json:"failure_threshold"`      // 连续失败多少次后熔断
	FailureWindowSeconds int    `json:"failure_window_seconds"` // 连续失败的计数窗口，超过窗口未再失败则清零
	CooldownSeconds      int    `json:"cooldown_seconds"`       // 首次熔断的冷却时长
	MaxCooldownSeconds   int    `json:"max_cooldown_seconds"`   // 指数退避的冷却时长上限
	StatusCodes          string `json:"status_codes"`           // 视为渠道故障的 HTTP 状态码规则
}

const (
	ChannelBreakerStatusCodesOptionKey = "channel_breaker_setting.status_codes"

	defaultChannelBreakerFailureThreshold     = 3
	defaultChannelBreakerFailureWindowSeconds = 60
	defaultChannelBreakerCooldownSeconds      = 30
	defaultChannelBreakerMaxCooldownSeconds   = 600
	defaultChannelBreakerStatusCodes          = "408,429,500-599"
)

var channelBreakerSetting = ChannelBreakerSetting{
	Enabled:              true,
	FailureThreshold:     defaultChannelBreakerFailureThreshold,
	FailureWindowSeconds: defaultChannelBreakerFailureWindowSeconds,
	CooldownSeconds:      defaultChannelBreakerCooldownSeconds,
	MaxCooldownSeconds:   defaultChannelBreakerMaxCooldownSeconds,
	StatusCodes:          defaultChannelBreakerStatusCodes,
}

var (
	channelBreakerStatusRangesLock   sync.RWMutex
	channelBreakerStatusRangesSource string
	channelBreakerStatusRanges       []StatusCodeRange
)

func init() {
	config.GlobalConfig.Register("channel_breaker_setting", &channelBreakerSetting)
}

// GetChannelBreakerSetting 返回归一化后的熔断配置，非法值回落到默认值，保证调用方无需再做防御。
func GetChannelBreakerSetting() ChannelBreakerSetting {
	setting := channelBreakerSetting
	if setting.FailureThreshold < 1 {
		setting.FailureThreshold = defaultChannelBreakerFailureThreshold
	}
	if setting.FailureWindowSeconds < 1 {
		setting.FailureWindowSeconds = defaultChannelBreakerFailureWindowSeconds
	}
	if setting.CooldownSeconds < 1 {
		setting.CooldownSeconds = defaultChannelBreakerCooldownSeconds
	}
	if setting.MaxCooldownSeconds < setting.CooldownSeconds {
		setting.MaxCooldownSeconds = setting.CooldownSeconds
	}
	if strings.TrimSpace(setting.StatusCodes) == "" {
		setting.StatusCodes = defaultChannelBreakerStatusCodes
	}
	return setting
}

// ChannelBreakerMatchesStatusCode 判断状态码是否命中熔断规则。
// 解析结果按原始字符串缓存，避免每次请求都重新解析。
func ChannelBreakerMatchesStatusCode(code int) bool {
	source := GetChannelBreakerSetting().StatusCodes

	channelBreakerStatusRangesLock.RLock()
	ranges, cached := channelBreakerStatusRanges, channelBreakerStatusRangesSource == source
	channelBreakerStatusRangesLock.RUnlock()

	if !cached {
		parsed, err := ParseHTTPStatusCodeRanges(source)
		if err != nil {
			parsed, _ = ParseHTTPStatusCodeRanges(defaultChannelBreakerStatusCodes)
		}
		channelBreakerStatusRangesLock.Lock()
		channelBreakerStatusRangesSource = source
		channelBreakerStatusRanges = parsed
		channelBreakerStatusRangesLock.Unlock()
		ranges = parsed
	}
	return shouldMatchStatusCodeRanges(ranges, code)
}

func ValidateChannelBreakerStatusCodes(value string) error {
	_, err := ParseHTTPStatusCodeRanges(value)
	return err
}

func ValidateChannelBreakerPositiveInt(key string, value string) error {
	n, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || n < 1 {
		return fmt.Errorf("%s 必须是大于 0 的整数", key)
	}
	return nil
}
