package helper

import (
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
)

// ConfiguredVideoBilling freezes the customer's resolution price in the same
// snapshot used by plugin task settlement. Provider ratios cannot price it twice.
func ConfiguredVideoBilling(info *relaycommon.RelayInfo, request any, facts map[string]any) (types.PriceData, bool, error) {
	modelName := info.OriginModelName
	if !ratio_setting.HasVideoGenerationPrice(modelName) {
		modelName = info.GetUpstreamModelName()
		if !ratio_setting.HasVideoGenerationPrice(modelName) {
			return types.PriceData{}, false, nil
		}
	}
	fail := func(err error) (types.PriceData, bool, error) {
		return types.PriceData{}, true, err
	}
	data, err := common.Marshal(request)
	if err != nil {
		return fail(err)
	}
	var body map[string]any
	if err = common.Unmarshal(data, &body); err != nil {
		return fail(err)
	}
	sources := []map[string]any{body}
	for _, key := range []string{"metadata", "parameters"} {
		if nested, ok := body[key].(map[string]any); ok {
			sources = append(sources, nested)
		}
	}
	var requestSeconds float64
	var resolution string
	for _, source := range sources {
		for _, key := range []string{"seconds", "duration"} {
			value, exists := source[key]
			if !exists || value == nil || value == "" {
				continue
			}
			seconds, parseErr := videoDurationSeconds(value)
			if parseErr != nil {
				return fail(parseErr)
			}
			if requestSeconds != 0 && seconds != requestSeconds {
				return fail(fmt.Errorf("conflicting video durations"))
			}
			requestSeconds = seconds
		}
		if resolution == "" {
			for _, key := range []string{"resolution", "size"} {
				if value, ok := source[key].(string); ok && strings.TrimSpace(value) != "" {
					resolution = value
					break
				}
			}
		}
	}
	seconds := requestSeconds
	if value, exists := facts["seconds"]; exists {
		seconds, err = videoDurationSeconds(value)
		if err != nil {
			return fail(err)
		}
		if requestSeconds != 0 && seconds != requestSeconds {
			return fail(fmt.Errorf("video duration differs from plugin billing facts"))
		}
	}
	if seconds == 0 {
		return fail(fmt.Errorf("video duration is required for per-second pricing"))
	}
	if resolution == "" {
		for _, key := range []string{"resolution", "size"} {
			if value, ok := facts[key].(string); ok && value != "" {
				resolution = value
				break
			}
		}
	}
	if resolution == "" {
		resolution = ratio_setting.VideoGenerationResolution720P
	}
	price, ok := ratio_setting.GetVideoGenerationPrice(modelName, resolution)
	if !ok {
		return fail(fmt.Errorf("video price is not configured for model %s at resolution %s", modelName, resolution))
	}
	expr := fmt.Sprintf("u(\"seconds\") * %s", strconv.FormatFloat(price, 'f', -1, 64))
	quota, clamp := common.QuotaFromFloatChecked(price * seconds * common.QuotaPerUnit)
	if info.QuotaClamp == nil {
		info.QuotaClamp = clamp
	}
	info.TieredBillingSnapshot = &billingexpr.BillingSnapshot{
		BillingMode: "tiered_expr", ModelName: info.OriginModelName,
		ExprString: expr, ExprHash: billingexpr.ExprHashString(expr),
		GroupRatio: 1, QuotaPerUnit: common.QuotaPerUnit,
		EstimatedQuotaBeforeGroup: price * seconds * common.QuotaPerUnit,
		EstimatedQuotaAfterGroup:  quota, ExprVersion: billingexpr.ExprVersion(expr),
		TaskUsageBilling: true, UsageFacts: map[string]any{"seconds": seconds},
	}
	return types.PriceData{
		ModelPrice: price, UsePrice: true, Quota: quota, QuotaToPreConsume: quota,
		VideoPriceConfigured: true, FreeModel: price == 0,
		GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1, GroupSpecialRatio: -1},
	}, true, nil
}

func videoDurationSeconds(value any) (float64, error) {
	var seconds float64
	switch v := value.(type) {
	case float64:
		seconds = v
	case int:
		seconds = float64(v)
	case int64:
		seconds = float64(v)
	case string:
		var err error
		seconds, err = strconv.ParseFloat(v, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid video duration")
		}
	default:
		return 0, fmt.Errorf("invalid video duration")
	}
	if math.IsNaN(seconds) || math.IsInf(seconds, 0) || seconds <= 0 || seconds > relaycommon.MaxTaskDurationSeconds {
		return 0, fmt.Errorf("video duration must be between 0 and %d seconds", relaycommon.MaxTaskDurationSeconds)
	}
	return seconds, nil
}
