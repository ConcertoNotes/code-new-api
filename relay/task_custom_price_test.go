package relay

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTaskSubmitCustomPricesDoNotMultiplyPluginRatios(t *testing.T) {
	savedVideo := ratio_setting.VideoGenerationPrice2JSONString()
	savedFixed := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateVideoGenerationPriceByJSONString(savedVideo))
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedFixed))
	})
	const plugin = mappingOrderSubmitPlugin + `
export function extractUsage(ctx) {
  if (ctx.usagePurpose !== "facts") throw new Error("custom prices must not use billing ratios");
  return {seconds:5, size:99};
}
export function extractUsageOnSubmit() { return {seconds:100, size:99}; }
`
	for _, tc := range []struct {
		name, video, fixed string
		want               int
		tiered             bool
	}{
		{"mapped per second", `{"declared-model":{"720p":0.15}}`, `{}`, 375000, true},
		{"public model price wins", `{"alias-model":{"720p":0.1},"declared-model":{"720p":0.15}}`, `{}`, 250000, true},
		{"fixed per request", `{}`, `{"alias-model":0.7}`, 350000, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.NoError(t, ratio_setting.UpdateVideoGenerationPriceByJSONString(tc.video))
			require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(tc.fixed))
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "/submit", r.URL.Path)
				w.Header().Set("Content-Type", "application/json")
				_, err := w.Write([]byte(`{"id":"1"}`))
				assert.NoError(t, err)
			}))
			defer upstream.Close()
			c, info := newTaskSubmitContext(t, "alias-model", `{"alias-model":"declared-model"}`)
			common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, upstream.URL)
			c.Set("group", "default")
			c.Set("task_request", map[string]any{"prompt": "p", "seconds": 5, "resolution": "720p"})
			pinMappingOrderPlugin(t, c, plugin)
			info.OriginModelName = "alias-model"
			info.RequestURLPath = "/v1/videos"
			info.UserGroup, info.UsingGroup = "default", "default"
			// Model a retry with an existing reservation; no live wallet is touched.
			info.Billing = &service.BillingSession{}
			result, taskErr := RelayTaskSubmit(c, info)
			require.Nil(t, taskErr)
			require.NotNil(t, result)
			assert.Equal(t, tc.want, result.Quota)
			assert.Equal(t, tc.tiered, info.TieredBillingSnapshot != nil)
			assert.Equal(t, !tc.tiered, info.PriceData.UsesPerCallBilling(false))
		})
	}
}
