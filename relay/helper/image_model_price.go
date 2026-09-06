package helper

import "strings"

// BaseImageModel resolves the local resolution/aspect aliases for price lookup.
func BaseImageModel(model string) string {
	model = strings.TrimSpace(model)
	normalized := strings.ToLower(model)
	for _, aspect := range []string{"1x1", "3x4", "4x3", "9x16", "16x9", "9x21", "21x9"} {
		for _, tier := range []string{"1k", "2k", "4k"} {
			suffix := "-" + tier + "-" + aspect
			if strings.HasSuffix(normalized, suffix) {
				return model[:len(model)-len(suffix)]
			}
		}
	}
	for _, tier := range []string{"1k", "2k", "4k"} {
		suffix := "-" + tier
		if strings.HasSuffix(normalized, suffix) {
			return model[:len(model)-len(suffix)]
		}
	}
	return model
}
