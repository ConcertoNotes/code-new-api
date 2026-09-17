package profit_setting

import (
	"errors"
	"math"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/types"
)

// ChannelUpstreamRatioOptionKey 是渠道上游倍率在 options 表中的键名
const ChannelUpstreamRatioOptionKey = "profit_setting.channel_upstream_ratio"

// DefaultUpstreamRatio 未单独配置上游倍率的渠道默认按官方价 1.0 倍计算成本
const DefaultUpstreamRatio = 1.0

// ProfitSetting 收支统计相关配置
type ProfitSetting struct {
	// ChannelUpstreamRatio 渠道 ID（字符串）-> 上游倍率（相对官方价）
	ChannelUpstreamRatio *types.RWMap[string, float64] `json:"channel_upstream_ratio"`
}

var profitSetting = ProfitSetting{
	ChannelUpstreamRatio: types.NewRWMap[string, float64](),
}

func init() {
	config.GlobalConfig.Register("profit_setting", &profitSetting)
}

func upstreamRatioMap() *types.RWMap[string, float64] {
	if profitSetting.ChannelUpstreamRatio == nil {
		profitSetting.ChannelUpstreamRatio = types.NewRWMap[string, float64]()
	}
	return profitSetting.ChannelUpstreamRatio
}

// GetChannelUpstreamRatio 返回渠道的上游倍率，未配置时返回默认值
func GetChannelUpstreamRatio(channelId int) float64 {
	ratio, ok := upstreamRatioMap().Get(strconv.Itoa(channelId))
	if !ok || ratio < 0 || math.IsNaN(ratio) || math.IsInf(ratio, 0) {
		return DefaultUpstreamRatio
	}
	return ratio
}

// GetChannelUpstreamRatioCopy 返回全部上游倍率的副本
func GetChannelUpstreamRatioCopy() map[string]float64 {
	return upstreamRatioMap().ReadAll()
}

// ValidateUpstreamRatio 校验上游倍率取值
func ValidateUpstreamRatio(ratio float64) error {
	if math.IsNaN(ratio) || math.IsInf(ratio, 0) {
		return errors.New("上游倍率必须是有效数字")
	}
	if ratio < 0 {
		return errors.New("上游倍率不能小于 0")
	}
	if ratio > 1000 {
		return errors.New("上游倍率不能大于 1000")
	}
	return nil
}

// BuildChannelUpstreamRatioJSON 在当前配置基础上更新单个渠道的倍率并返回新的 JSON
func BuildChannelUpstreamRatioJSON(channelId int, ratio float64) (string, error) {
	if err := ValidateUpstreamRatio(ratio); err != nil {
		return "", err
	}
	ratios := GetChannelUpstreamRatioCopy()
	ratios[strconv.Itoa(channelId)] = ratio
	data, err := common.Marshal(ratios)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// ValidateChannelUpstreamRatioJSON 校验 options 中保存的上游倍率 JSON
func ValidateChannelUpstreamRatioJSON(jsonStr string) error {
	ratios := make(map[string]float64)
	if err := common.UnmarshalJsonStr(jsonStr, &ratios); err != nil {
		return err
	}
	for key, ratio := range ratios {
		if _, err := strconv.Atoi(key); err != nil {
			return errors.New("上游倍率的渠道 ID 无效: " + key)
		}
		if err := ValidateUpstreamRatio(ratio); err != nil {
			return err
		}
	}
	return nil
}
