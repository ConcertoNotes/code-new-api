package ratio_setting

import (
	"fmt"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

const (
	ImageGenerationTier1K = "1K"
	ImageGenerationTier2K = "2K"
	ImageGenerationTier4K = "4K"
)

var imageGenerationPriceMap = types.NewRWMap[string, map[string]float64]()

func ImageGenerationPrice2JSONString() string {
	return imageGenerationPriceMap.MarshalJSONString()
}

func UpdateImageGenerationPriceByJSONString(jsonStr string) error {
	prices := make(map[string]map[string]float64)
	if err := common.UnmarshalJsonStr(jsonStr, &prices); err != nil {
		return err
	}

	normalizedPrices := make(map[string]map[string]float64, len(prices))
	for model, tiers := range prices {
		model = strings.TrimSpace(model)
		if model == "" {
			return fmt.Errorf("image generation price model name cannot be empty")
		}
		normalizedTiers := make(map[string]float64, len(tiers))
		for tier, price := range tiers {
			normalizedTier := strings.ToUpper(strings.TrimSpace(tier))
			switch normalizedTier {
			case ImageGenerationTier1K, ImageGenerationTier2K, ImageGenerationTier4K:
			default:
				return fmt.Errorf("unsupported image generation price tier %q for model %q", tier, model)
			}
			if price < 0 || math.IsNaN(price) || math.IsInf(price, 0) {
				return fmt.Errorf("image generation price for model %q tier %q must be a finite non-negative number", model, tier)
			}
			normalizedTiers[normalizedTier] = price
		}
		normalizedPrices[model] = normalizedTiers
	}

	imageGenerationPriceMap.Clear()
	imageGenerationPriceMap.AddAll(normalizedPrices)
	InvalidateExposedDataCache()
	return nil
}

func GetImageGenerationPrice(model, tier string) (float64, bool) {
	tiers, ok := imageGenerationPriceMap.Get(model)
	if !ok {
		return 0, false
	}
	price, ok := tiers[strings.ToUpper(strings.TrimSpace(tier))]
	return price, ok
}

func GetImageGenerationPriceCopy() map[string]map[string]float64 {
	source := imageGenerationPriceMap.ReadAll()
	result := make(map[string]map[string]float64, len(source))
	for model, tiers := range source {
		copiedTiers := make(map[string]float64, len(tiers))
		for tier, price := range tiers {
			copiedTiers[tier] = price
		}
		result[model] = copiedTiers
	}
	return result
}
