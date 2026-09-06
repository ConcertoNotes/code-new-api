package helper

import (
	"math"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConfiguredVideoBillingUsesFrozenResolutionPrice(t *testing.T) {
	saved := ratio_setting.VideoGenerationPrice2JSONString()
	t.Cleanup(func() { require.NoError(t, ratio_setting.UpdateVideoGenerationPriceByJSONString(saved)) })
	require.NoError(t, ratio_setting.UpdateVideoGenerationPriceByJSONString(
		`{"video":{"720p":0.15,"1080p":0.2},"public-video":{"720p":0.1},"free":{"720p":0}}`))
	for _, tc := range []struct {
		name, model, upstream, resolution string
		want                              int
	}{
		{"public price wins", "public-video", "video", "720p", 250000},
		{"mapped model price", "alias", "video", "1280x720", 375000},
		{"resolution price", "video", "", "1080p", 500000},
		{"explicit free price", "free", "video", "720p", 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{OriginModelName: tc.model, ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: tc.upstream}}
			price, configured, err := ConfiguredVideoBilling(info, map[string]any{"seconds": "5", "resolution": tc.resolution}, map[string]any{"seconds": float64(5), "size": "1280x720", "ratio": 99})
			require.NoError(t, err)
			require.True(t, configured)
			assert.Equal(t, tc.want, price.Quota)
			assert.Equal(t, 1.0, price.GroupRatioInfo.GroupRatio)
			assert.False(t, price.UsesPerCallBilling(true))
			require.NotNil(t, info.TieredBillingSnapshot)
			raw, err := common.Marshal(info.TieredBillingSnapshot)
			require.NoError(t, err)
			var snapshot billingexpr.BillingSnapshot
			require.NoError(t, common.Unmarshal(raw, &snapshot))
			result, err := billingexpr.ComputeTieredQuotaWithRequest(&snapshot, billingexpr.TokenParams{}, billingexpr.RequestInput{Usage: map[string]any{"seconds": float64(8)}})
			require.NoError(t, err)
			assert.Equal(t, tc.want*8/5, result.ActualQuotaAfterGroup)
		})
	}
}

func TestConfiguredVideoBillingRejectsInvalidOrAmbiguousQuantities(t *testing.T) {
	saved := ratio_setting.VideoGenerationPrice2JSONString()
	t.Cleanup(func() { require.NoError(t, ratio_setting.UpdateVideoGenerationPriceByJSONString(saved)) })
	require.NoError(t, ratio_setting.UpdateVideoGenerationPriceByJSONString(`{"video":{"720p":0.1}}`))
	for _, tc := range []struct {
		name    string
		request map[string]any
		facts   map[string]any
	}{
		{"negative", map[string]any{"seconds": -1}, nil},
		{"zero", map[string]any{"seconds": 0}, nil},
		{"oversized", map[string]any{"seconds": relaycommon.MaxTaskDurationSeconds + 1}, nil},
		{"wrapped unsigned", map[string]any{"seconds": "18446744073686646784"}, nil},
		{"missing duration", map[string]any{}, nil},
		{"metadata bypass", map[string]any{"seconds": 5, "metadata": map[string]any{"duration": 99999}}, nil},
		{"parameters bypass", map[string]any{"parameters": map[string]any{"seconds": 99999}}, nil},
		{"conflicting seconds", map[string]any{"seconds": 5, "duration": 10}, nil},
		{"plugin disagreement", map[string]any{"seconds": 5}, map[string]any{"seconds": float64(4)}},
		{"nonfinite facts", map[string]any{}, map[string]any{"seconds": math.NaN()}},
		{"missing resolution price", map[string]any{"seconds": 5, "resolution": "4k"}, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{OriginModelName: "video"}
			_, configured, err := ConfiguredVideoBilling(info, tc.request, tc.facts)
			assert.True(t, configured)
			require.Error(t, err)
			assert.Nil(t, info.TieredBillingSnapshot)
		})
	}
}

func TestTaskFixedPriceAndExactVideoModelLookup(t *testing.T) {
	savedPrices, savedRatios := ratio_setting.ModelPrice2JSONString(), ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedPrices))
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedRatios))
	})
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"custom-video":0.7,"similar-*":99}`))
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{}`))
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("group", "default")
	info := &relaycommon.RelayInfo{OriginModelName: "custom-video", RequestURLPath: "/v1/videos", UsingGroup: "default", UserGroup: "default"}
	price, err := ModelPriceHelperPerCall(c, info)
	require.NoError(t, err)
	assert.Equal(t, 350000, price.Quota)
	assert.True(t, price.FixedPrice)
	assert.True(t, price.UsesPerCallBilling(false))
	info.OriginModelName = "similar-new"
	_, err = ModelPriceHelperPerCall(c, info)
	require.Error(t, err)
}

func TestImageResolutionPriceAppliesCountExactlyOnce(t *testing.T) {
	saved := ratio_setting.ImageGenerationPrice2JSONString()
	t.Cleanup(func() { require.NoError(t, ratio_setting.UpdateImageGenerationPriceByJSONString(saved)) })
	require.NoError(t, ratio_setting.UpdateImageGenerationPriceByJSONString(`{"custom-image":{"4K":0.15}}`))
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("group", "default")
	count := uint(3)
	request := &dto.ImageRequest{Model: "custom-image", Size: "4k", N: &count}
	info := &relaycommon.RelayInfo{OriginModelName: "custom-image", UsingGroup: "default", UserGroup: "default"}
	price, err := ModelPriceHelper(c, info, 0, request.GetTokenCountMeta())
	require.NoError(t, err)
	assert.Equal(t, 0.15, price.ModelPrice)
	assert.InDelta(t, 225000, float64(price.QuotaToPreConsume), 1)
	assert.Equal(t, 3.0, price.OtherRatioMultiplier())
}
