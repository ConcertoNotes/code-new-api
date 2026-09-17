package profit_setting

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func resetUpstreamRatios(t *testing.T) {
	t.Helper()
	previous := GetChannelUpstreamRatioCopy()
	upstreamRatioMap().Clear()
	t.Cleanup(func() {
		upstreamRatioMap().Clear()
		upstreamRatioMap().AddAll(previous)
	})
}

func TestGetChannelUpstreamRatioFallsBackToDefault(t *testing.T) {
	resetUpstreamRatios(t)
	upstreamRatioMap().Set("2", 0.5)
	upstreamRatioMap().Set("3", -1)

	assert.Equal(t, DefaultUpstreamRatio, GetChannelUpstreamRatio(1))
	assert.Equal(t, 0.5, GetChannelUpstreamRatio(2))
	// 非法值不会影响计算，按默认倍率处理
	assert.Equal(t, DefaultUpstreamRatio, GetChannelUpstreamRatio(3))
}

func TestBuildChannelUpstreamRatioJSONKeepsOtherChannels(t *testing.T) {
	resetUpstreamRatios(t)
	upstreamRatioMap().Set("1", 0.8)

	jsonStr, err := BuildChannelUpstreamRatioJSON(2, 1.25)
	require.NoError(t, err)
	assert.JSONEq(t, `{"1":0.8,"2":1.25}`, jsonStr)

	_, err = BuildChannelUpstreamRatioJSON(2, -0.1)
	assert.Error(t, err)
	_, err = BuildChannelUpstreamRatioJSON(2, math.NaN())
	assert.Error(t, err)
	_, err = BuildChannelUpstreamRatioJSON(2, 1001)
	assert.Error(t, err)
}

func TestValidateChannelUpstreamRatioJSON(t *testing.T) {
	assert.NoError(t, ValidateChannelUpstreamRatioJSON(`{}`))
	assert.NoError(t, ValidateChannelUpstreamRatioJSON(`{"1":0,"2":2.5}`))
	assert.Error(t, ValidateChannelUpstreamRatioJSON(`{"abc":1}`))
	assert.Error(t, ValidateChannelUpstreamRatioJSON(`{"1":-1}`))
	assert.Error(t, ValidateChannelUpstreamRatioJSON(`not json`))
}

func TestOptionReloadReplacesUpstreamRatios(t *testing.T) {
	resetUpstreamRatios(t)
	upstreamRatioMap().Set("9", 3)

	// 模拟从 options 表重新加载：旧键必须被清除，新键生效
	cfg := config.GlobalConfig.Get("profit_setting")
	require.NotNil(t, cfg)
	require.NoError(t, config.UpdateConfigFromMap(cfg, map[string]string{
		"channel_upstream_ratio": `{"1":0.7}`,
	}))
	assert.Equal(t, 0.7, GetChannelUpstreamRatio(1))
	assert.Equal(t, DefaultUpstreamRatio, GetChannelUpstreamRatio(9))
}

func TestNormalizeRowKeys(t *testing.T) {
	keys, err := NormalizeRowKeys([]string{" 1|default ", "2|vip", "1|default", ""})
	require.NoError(t, err)
	assert.Equal(t, []string{"1|default", "2|vip"}, keys)

	_, err = NormalizeRowKeys([]string{"default"})
	assert.Error(t, err)
	_, err = NormalizeRowKeys([]string{"0|default"})
	assert.Error(t, err)
	_, err = NormalizeRowKeys([]string{"abc|default"})
	assert.Error(t, err)
}

func TestRowKeysOptionRoundTrip(t *testing.T) {
	previousOrder, previousHidden := profitSetting.RowOrder, profitSetting.HiddenRows
	t.Cleanup(func() {
		profitSetting.RowOrder, profitSetting.HiddenRows = previousOrder, previousHidden
	})

	jsonStr, err := BuildRowKeysJSON([]string{"3|vip", "1|default"})
	require.NoError(t, err)
	assert.JSONEq(t, `["3|vip","1|default"]`, jsonStr)
	assert.NoError(t, ValidateRowKeysJSON(jsonStr))
	assert.NoError(t, ValidateRowKeysJSON(""))
	assert.Error(t, ValidateRowKeysJSON(`["bad"]`))

	cfg := config.GlobalConfig.Get("profit_setting")
	require.NoError(t, config.UpdateConfigFromMap(cfg, map[string]string{
		"row_order":   jsonStr,
		"hidden_rows": `["2|default"]`,
	}))
	assert.Equal(t, []string{"3|vip", "1|default"}, GetRowOrder())
	assert.Equal(t, []string{"2|default"}, GetHiddenRows())

	// 非法 JSON 不应导致崩溃，按空列表处理
	profitSetting.HiddenRows = "not json"
	assert.Nil(t, GetHiddenRows())
}

func TestValidateStatsStartAt(t *testing.T) {
	assert.NoError(t, ValidateStatsStartAt("0"))
	assert.NoError(t, ValidateStatsStartAt("1700000000"))
	assert.Error(t, ValidateStatsStartAt("-1"))
	assert.Error(t, ValidateStatsStartAt("abc"))
}
