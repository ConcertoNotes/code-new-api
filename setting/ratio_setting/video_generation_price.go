package ratio_setting

import (
	"fmt"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

const (
	VideoGenerationResolution480P  = "480p"
	VideoGenerationResolution720P  = "720p"
	VideoGenerationResolution1080P = "1080p"
	VideoGenerationResolution4K    = "4k"
)

var videoGenerationPriceMap = types.NewRWMap[string, map[string]float64]()

func VideoGenerationPrice2JSONString() string {
	return videoGenerationPriceMap.MarshalJSONString()
}

func UpdateVideoGenerationPriceByJSONString(jsonStr string) error {
	normalizedPrices, err := parseVideoGenerationPrices(jsonStr)
	if err != nil {
		return err
	}

	videoGenerationPriceMap.Clear()
	videoGenerationPriceMap.AddAll(normalizedPrices)
	InvalidateExposedDataCache()
	return nil
}

func ValidateVideoGenerationPriceJSON(jsonStr string) error {
	_, err := parseVideoGenerationPrices(jsonStr)
	return err
}

func parseVideoGenerationPrices(jsonStr string) (map[string]map[string]float64, error) {
	prices := make(map[string]map[string]float64)
	if err := common.UnmarshalJsonStr(jsonStr, &prices); err != nil {
		return nil, err
	}

	normalizedPrices := make(map[string]map[string]float64, len(prices))
	for model, tiers := range prices {
		model = strings.TrimSpace(model)
		if model == "" {
			return nil, fmt.Errorf("video generation price model name cannot be empty")
		}
		normalizedTiers := make(map[string]float64, len(tiers))
		for resolution, price := range tiers {
			normalizedResolution, ok := normalizeVideoResolution(resolution)
			if !ok {
				return nil, fmt.Errorf("video generation resolution cannot be empty for model %q", model)
			}
			if price < 0 || math.IsNaN(price) || math.IsInf(price, 0) {
				return nil, fmt.Errorf("video generation price for model %q resolution %q must be a finite non-negative number", model, resolution)
			}
			if _, exists := normalizedTiers[normalizedResolution]; exists {
				return nil, fmt.Errorf("duplicate video generation resolution %q for model %q", normalizedResolution, model)
			}
			normalizedTiers[normalizedResolution] = price
		}
		normalizedPrices[model] = normalizedTiers
	}

	return normalizedPrices, nil
}

func GetVideoGenerationPrice(model, resolution string) (float64, bool) {
	tiers, ok := videoGenerationPriceMap.Get(FormatMatchingModelName(model))
	if !ok {
		return 0, false
	}
	normalizedResolution, ok := normalizeVideoResolution(resolution)
	if !ok {
		return 0, false
	}
	price, ok := tiers[normalizedResolution]
	return price, ok
}

func HasVideoGenerationPrice(model string) bool {
	_, ok := videoGenerationPriceMap.Get(FormatMatchingModelName(model))
	return ok
}

func GetVideoGenerationPriceCopy() map[string]map[string]float64 {
	source := videoGenerationPriceMap.ReadAll()
	result := make(map[string]map[string]float64, len(source))
	for model, tiers := range source {
		copiedTiers := make(map[string]float64, len(tiers))
		for resolution, price := range tiers {
			copiedTiers[resolution] = price
		}
		result[model] = copiedTiers
	}
	return result
}

func normalizeVideoResolution(resolution string) (string, bool) {
	normalized := strings.ToLower(strings.TrimSpace(resolution))
	switch normalized {
	case "":
		return "", false
	case "480p", "854x480", "480x854":
		return VideoGenerationResolution480P, true
	case "720p", "1280x720", "720x1280":
		return VideoGenerationResolution720P, true
	case "1080p", "1920x1080", "1080x1920":
		return VideoGenerationResolution1080P, true
	case "4k", "2160p", "3840x2160", "2160x3840":
		return VideoGenerationResolution4K, true
	default:
		return normalized, true
	}
}
