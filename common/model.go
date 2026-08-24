package common

import "strings"

var (
	// OpenAIResponseOnlyModels is a list of models that are only available for OpenAI responses.
	OpenAIResponseOnlyModels = []string{
		"o3-pro",
		"o3-deep-research",
		"o4-mini-deep-research",
	}
	ImageGenerationModels = []string{
		"dall-e-3",
		"dall-e-2",
		"gpt-image-",
		"prefix:imagen-",
		"flux-",
		"flux.1-",
	}
	OpenAITextModels = []string{
		"gpt-",
		"o1",
		"o3",
		"o4",
		"chatgpt",
	}
)

func IsOpenAIResponseOnlyModel(modelName string) bool {
	for _, m := range OpenAIResponseOnlyModels {
		if strings.Contains(modelName, m) {
			return true
		}
	}
	return false
}

func IsImageGenerationModel(modelName string) bool {
	modelName = strings.ToLower(modelName)
	for _, m := range ImageGenerationModels {
		if strings.Contains(modelName, m) {
			return true
		}
		if strings.HasPrefix(m, "prefix:") && strings.HasPrefix(modelName, strings.TrimPrefix(m, "prefix:")) {
			return true
		}
	}
	return false
}

// PublicImageModelName collapses the internal resolution/aspect aliases used
// for image channel selection back to the model name clients should see.
// Routing still uses the aliases; this only controls model-list responses and
// other user-facing model collections.
func PublicImageModelName(modelName string) string {
	normalized := strings.ToLower(strings.TrimSpace(modelName))
	base := normalized
	for _, aspect := range []string{"1x1", "3x4", "4x3", "9x16", "16x9", "9x21", "21x9"} {
		for _, tier := range []string{"1k", "2k", "4k"} {
			suffix := "-" + tier + "-" + aspect
			if strings.HasSuffix(base, suffix) {
				base = strings.TrimSuffix(base, suffix)
				break
			}
		}
	}
	for _, tier := range []string{"1k", "2k", "4k"} {
		if strings.HasSuffix(base, "-"+tier) {
			base = strings.TrimSuffix(base, "-"+tier)
			break
		}
	}
	if base != normalized && IsImageGenerationModel(base) {
		return base
	}
	return strings.TrimSpace(modelName)
}

// CollapseImageModelVariants removes internal image aliases while preserving
// the first-seen order of the public model list.
func CollapseImageModelVariants(models []string) []string {
	result := make([]string, 0, len(models))
	seen := make(map[string]struct{}, len(models))
	for _, modelName := range models {
		publicName := PublicImageModelName(modelName)
		if publicName == "" {
			continue
		}
		if _, exists := seen[publicName]; exists {
			continue
		}
		seen[publicName] = struct{}{}
		result = append(result, publicName)
	}
	return result
}

func IsOpenAITextModel(modelName string) bool {
	modelName = strings.ToLower(modelName)
	for _, m := range OpenAITextModels {
		if strings.Contains(modelName, m) {
			return true
		}
	}
	return false
}
