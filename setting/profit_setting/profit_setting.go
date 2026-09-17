package profit_setting

import (
	"errors"
	"math"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/types"
)

// ChannelUpstreamRatioOptionKey 是渠道上游倍率在 options 表中的键名
const ChannelUpstreamRatioOptionKey = "profit_setting.channel_upstream_ratio"

// DefaultUpstreamRatio 未单独配置上游倍率的渠道默认按官方价 1.0 倍计算成本
const DefaultUpstreamRatio = 1.0

// StatsStartAtOptionKey 收支统计起点（Unix 秒），早于该时间的日志不计入
const StatsStartAtOptionKey = "profit_setting.stats_start_at"

// RowOrderOptionKey 明细行的自定义显示顺序（JSON 数组，元素为行键 "渠道ID|分组"）
const RowOrderOptionKey = "profit_setting.row_order"

// HiddenRowsOptionKey 被用户从收支页移除的明细行（JSON 数组，元素为行键）
const HiddenRowsOptionKey = "profit_setting.hidden_rows"

// 行键列表的最大长度，防止 options 里无限膨胀
const maxRowKeys = 5000

// ProfitSetting 收支统计相关配置
type ProfitSetting struct {
	// ChannelUpstreamRatio 渠道 ID（字符串）-> 上游倍率（相对官方价）
	ChannelUpstreamRatio *types.RWMap[string, float64] `json:"channel_upstream_ratio"`
	// StatsStartAt 统计起点，0 表示尚未初始化
	StatsStartAt int64 `json:"stats_start_at"`
	// RowOrder 明细行显示顺序（JSON 数组字符串）
	RowOrder string `json:"row_order"`
	// HiddenRows 被移除的明细行（JSON 数组字符串）
	HiddenRows string `json:"hidden_rows"`
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

// RowKey 生成明细行键：渠道 ID + 分组
func RowKey(channelId int, group string) string {
	return strconv.Itoa(channelId) + "|" + group
}

// GetStatsStartAt 返回统计起点，0 表示尚未初始化
func GetStatsStartAt() int64 {
	return profitSetting.StatsStartAt
}

// ValidateStatsStartAt 校验统计起点
func ValidateStatsStartAt(value string) error {
	ts, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
	if err != nil || ts < 0 {
		return errors.New("统计起点必须是非负的 Unix 时间戳")
	}
	return nil
}

func parseRowKeys(jsonStr string) []string {
	if strings.TrimSpace(jsonStr) == "" {
		return nil
	}
	var keys []string
	if err := common.UnmarshalJsonStr(jsonStr, &keys); err != nil {
		return nil
	}
	return keys
}

// GetRowOrder 返回明细行自定义顺序
func GetRowOrder() []string {
	return parseRowKeys(profitSetting.RowOrder)
}

// GetHiddenRows 返回被移除的明细行键
func GetHiddenRows() []string {
	return parseRowKeys(profitSetting.HiddenRows)
}

// NormalizeRowKeys 去空白、去重，并校验行键格式与数量
func NormalizeRowKeys(keys []string) ([]string, error) {
	if len(keys) > maxRowKeys {
		return nil, errors.New("行键数量超出上限")
	}
	seen := make(map[string]struct{}, len(keys))
	normalized := make([]string, 0, len(keys))
	for _, key := range keys {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		channelPart, _, ok := strings.Cut(key, "|")
		if !ok {
			return nil, errors.New("行键格式无效: " + key)
		}
		if channelId, err := strconv.Atoi(channelPart); err != nil || channelId <= 0 {
			return nil, errors.New("行键中的渠道 ID 无效: " + key)
		}
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		normalized = append(normalized, key)
	}
	return normalized, nil
}

// BuildRowKeysJSON 把行键列表规范化后序列化为 JSON
func BuildRowKeysJSON(keys []string) (string, error) {
	normalized, err := NormalizeRowKeys(keys)
	if err != nil {
		return "", err
	}
	data, err := common.Marshal(normalized)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// ValidateRowKeysJSON 校验 options 中保存的行键 JSON
func ValidateRowKeysJSON(jsonStr string) error {
	if strings.TrimSpace(jsonStr) == "" {
		return nil
	}
	var keys []string
	if err := common.UnmarshalJsonStr(jsonStr, &keys); err != nil {
		return err
	}
	_, err := NormalizeRowKeys(keys)
	return err
}
