package operation_setting

import (
	"fmt"
	"math"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/setting/config"
)

// LotterySetting 噜噜充值抽奖活动配置
type LotterySetting struct {
	Enabled        bool    `json:"enabled"`         // 活动总开关
	StartTime      int64   `json:"start_time"`      // 活动开始时间（Unix 秒）
	EndTime        int64   `json:"end_time"`        // 活动结束时间（Unix 秒，不含）
	ThresholdMoney float64 `json:"threshold_money"` // 每累计充值多少元获得 1 次抽奖
	PayoutRatio    float64 `json:"payout_ratio"`    // 活动累计发放奖励不得超过活动累计充值额的比例
	ReserveQuota   float64 `json:"reserve_quota"`   // 预算安全储备（额度），先从预算里扣掉
	// NextPrizeAmount 管理员指定的下一次真实抽奖奖励（额度），0 表示不指定、按默认规则抽取；
	// 被一次抽奖消费后自动归零。抽奖时以数据库中的值为准，保证多实例下只被消费一次。
	NextPrizeAmount float64 `json:"next_prize_amount"`
}

// LotteryNextPrizeOptionKey 指定下一次抽奖奖励的配置项
const LotteryNextPrizeOptionKey = "lottery_setting.next_prize_amount"

var lotteryTimeZone = time.FixedZone("Asia/Shanghai", 8*3600)

// 默认配置：2026-09-25 00:00 至 2026-10-08 00:00（北京时间）
var lotterySetting = LotterySetting{
	Enabled:        true,
	StartTime:      time.Date(2026, 9, 25, 0, 0, 0, 0, lotteryTimeZone).Unix(),
	EndTime:        time.Date(2026, 10, 8, 0, 0, 0, 0, lotteryTimeZone).Unix(),
	ThresholdMoney: 20,
	PayoutRatio:    0.25,
	ReserveQuota:   0,
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("lottery_setting", &lotterySetting)
}

// GetLotterySetting 获取抽奖配置
func GetLotterySetting() *LotterySetting {
	return &lotterySetting
}

// IsActive 活动是否在指定时刻进行中
func (s *LotterySetting) IsActive(now int64) bool {
	return s.Enabled && now >= s.StartTime && now < s.EndTime
}

// EffectiveThreshold 返回合法的抽奖门槛，避免配置为 0 或负数时除零或无限送次数
func (s *LotterySetting) EffectiveThreshold() float64 {
	if s.ThresholdMoney <= 0 {
		return 20
	}
	return s.ThresholdMoney
}

// ParseLotteryNextPrizeAmount 解析指定奖励额度，必须是有限的非负数
func ParseLotteryNextPrizeAmount(value string) (float64, error) {
	amount, err := strconv.ParseFloat(value, 64)
	if err != nil || math.IsNaN(amount) || math.IsInf(amount, 0) || amount < 0 {
		return 0, fmt.Errorf("%s must be a finite non-negative number", LotteryNextPrizeOptionKey)
	}
	return amount, nil
}
