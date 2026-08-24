package helper

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
)

var explicitImageSizePattern = regexp.MustCompile(`(?i)(?:\bsize|\bdimensions?|\bresolution|大小|尺寸|分辨率|像素)\s*(?:为|是|[:：=])?\s*([1-9][0-9]{1,4})\s*[x*]\s*([1-9][0-9]{1,4})`)

// ResolveImageRequestSize extracts an explicitly labelled pixel size from the
// prompt for clients such as Cherry Studio that always send 1024x1024 even
// when the user requested another exact size in the prompt. A non-default
// structured pixel size remains authoritative.
func ResolveImageRequestSize(size, prompt string) string {
	size = strings.TrimSpace(size)
	prompt = strings.ReplaceAll(prompt, "×", "x")
	match := explicitImageSizePattern.FindStringSubmatch(prompt)
	if len(match) != 3 {
		return size
	}

	normalizedSize := strings.ToLower(size)
	if normalizedSize != "" && normalizedSize != "auto" && normalizedSize != "1024x1024" && normalizeImageTier(normalizedSize) == "" {
		return size
	}
	return match[1] + "x" + match[2]
}

// ResolveImageModelVariant returns the model alias used for automatic image
// channel selection. The alias is intentionally deterministic so channels can
// expose only the variants they support, while callers that do not configure
// variants can fall back to the original model during distribution.
func ResolveImageModelVariant(model, size string) string {
	model = strings.TrimSpace(model)
	if model == "" {
		return model
	}
	tier, aspect, ok := classifyImageSize(size)
	if !ok {
		return model
	}
	if _, ok := imageModelResolutionAspect(model); ok {
		return model
	}
	if imageModelResolutionTier(model) == "" {
		model = fmt.Sprintf("%s-%s", model, strings.ToLower(tier))
	}
	return fmt.Sprintf("%s-%s", model, strings.ReplaceAll(aspect, ":", "x"))
}

// ImageModelSelectionCandidates orders automatic image aliases from most to
// least specific: resolution+aspect, resolution only, then the requested model.
func ImageModelSelectionCandidates(model, size string) []string {
	return ImageModelSelectionCandidatesWithOptions(model, size, "", "")
}

// ImageModelSelectionCandidatesWithOptions accepts both the OpenAI-compatible
// size field and common structured resolution/aspect-ratio fields. A valid size
// is authoritative; resolution is consulted only when size cannot identify a
// tier. This runs before channel selection and therefore applies to every image
// channel rather than relying on a provider adaptor.
func ImageModelSelectionCandidatesWithOptions(model, size, resolution, aspectRatio string) []string {
	model = strings.TrimSpace(model)
	effectiveSize := imageSelectionSize(size, resolution, aspectRatio)
	variant := ResolveImageModelVariant(model, effectiveSize)
	if variant == model {
		return []string{model}
	}
	candidates := []string{variant}
	if _, ok := imageModelResolutionAspect(variant); ok {
		lastDash := strings.LastIndex(variant, "-")
		if lastDash > 0 {
			tierVariant := variant[:lastDash]
			if tierVariant != model {
				candidates = append(candidates, tierVariant)
			}
		}
	}
	candidates = append(candidates, model)
	baseModel := BaseImageModel(model)
	if baseModel != model {
		candidates = append(candidates, baseModel)
	}
	return candidates
}

func imageSelectionSize(size, resolution, aspectRatio string) string {
	size = strings.TrimSpace(size)
	aspectRatio = normalizeImageAspect(aspectRatio)
	if _, _, ok := classifyImageSize(size); ok {
		return size
	}

	tier := normalizeImageTier(size)
	if tier == "" {
		tier = normalizeImageTier(resolution)
	}
	if tier != "" {
		if aspectRatio == "" {
			aspectRatio = "1:1"
		}
		return imageTierSize(tier, aspectRatio)
	}
	if aspectRatio != "" {
		return imageTierSize("2k", aspectRatio)
	}
	return size
}

// ResolveImageRequestTier returns the effective 1K/2K/4K tier for a request.
// Size has priority over resolution, matching routing, forwarding, and billing.
func ResolveImageRequestTier(size, resolution string) string {
	if tier, ok := dto.ClassifyImageBillingTier(size); ok {
		return tier
	}
	if tier, ok := dto.ClassifyImageBillingTier(resolution); ok {
		return tier
	}
	return ""
}

const (
	gptImage2MinPixels = 655360
	gptImage2MaxPixels = 8294400
	gptImage2MaxSide   = 3840
)

// ValidateGPTImage2Size validates an explicit gpt-image-2 output canvas.
// Tier labels remain valid gateway inputs; physical sizes follow the upstream
// model's exact-size contract.
func ValidateGPTImage2Size(size string) error {
	raw := strings.TrimSpace(size)
	if raw == "" || strings.EqualFold(raw, "auto") || normalizeImageTier(raw) != "" {
		return nil
	}

	width, height, ok := parseImageSize(raw)
	if !ok {
		return fmt.Errorf("image size %q must use WIDTHxHEIGHT format, a 1K/2K/4K tier, or auto", raw)
	}
	if width%16 != 0 || height%16 != 0 {
		return fmt.Errorf("image size %q is invalid: width and height must be multiples of 16", raw)
	}
	longSide, shortSide := width, height
	if height > width {
		longSide, shortSide = height, width
	}
	if longSide > gptImage2MaxSide {
		return fmt.Errorf("image size %q is invalid: longest side %d exceeds max %d", raw, longSide, gptImage2MaxSide)
	}
	pixels := int64(width) * int64(height)
	if pixels < gptImage2MinPixels {
		return fmt.Errorf("image size %q is invalid: total pixels %d is below min %d", raw, pixels, gptImage2MinPixels)
	}
	if pixels > gptImage2MaxPixels {
		return fmt.Errorf("image size %q is invalid: total pixels %d exceeds max %d", raw, pixels, gptImage2MaxPixels)
	}
	if int64(longSide) > int64(shortSide)*3 {
		return fmt.Errorf("image size %q is invalid: aspect ratio must not exceed 3:1", raw)
	}
	return nil
}

// NormalizeImageRequestResolution records the request-level effective tier
// before provider conversion. Exact WIDTHxHEIGHT values remain unchanged.
func NormalizeImageRequestResolution(request *dto.ImageRequest) {
	if request == nil {
		return
	}
	request.Size = ResolveImageRequestSize(request.Size, request.Prompt)
	resolution := ""
	if request.Resolution != nil {
		resolution = *request.Resolution
	}
	tier := ResolveImageRequestTier(request.Size, resolution)
	if tier != "" {
		request.Resolution = &tier
	}
}

func normalizeImageTier(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1k", "1kpx", "1k-resolution", "1":
		return "1k"
	case "2k", "2kpx", "2k-resolution", "2":
		return "2k"
	case "4k", "4kpx", "4k-resolution", "4":
		return "4k"
	default:
		return ""
	}
}

func normalizeImageAspect(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	normalized = strings.ReplaceAll(normalized, " ", "")
	normalized = strings.ReplaceAll(normalized, "×", "x")
	normalized = strings.ReplaceAll(normalized, ":", "x")
	normalized = strings.ReplaceAll(normalized, "/", "x")
	for _, supported := range []string{"1x1", "3x4", "4x3", "9x16", "16x9", "9x21", "21x9"} {
		if normalized == supported {
			return strings.ReplaceAll(supported, "x", ":")
		}
	}
	return ""
}

// BaseImageModel removes the automatic resolution and aspect suffixes so a
// routed alias can inherit the base model's tiered image price.
func BaseImageModel(model string) string {
	normalized := strings.ToLower(strings.TrimSpace(model))
	for _, aspect := range []string{"1x1", "3x4", "4x3", "9x16", "16x9", "9x21", "21x9"} {
		for _, tier := range []string{"1k", "2k", "4k"} {
			suffix := "-" + tier + "-" + aspect
			if strings.HasSuffix(normalized, suffix) {
				return strings.TrimSpace(model[:len(model)-len(suffix)])
			}
		}
	}
	for _, tier := range []string{"1k", "2k", "4k"} {
		suffix := "-" + tier
		if strings.HasSuffix(normalized, suffix) {
			return strings.TrimSpace(model[:len(model)-len(suffix)])
		}
	}
	return strings.TrimSpace(model)
}

// ImageModelTierVariant removes only the aspect suffix from an automatic
// image variant. Channel selection may use the full resolution/aspect alias,
// while compatible upstreams use the tier alias to enable physical upscaling.
func ImageModelTierVariant(model string) string {
	model = strings.TrimSpace(model)
	if aspect, ok := imageModelResolutionAspect(model); ok {
		return strings.TrimSuffix(model, "-"+strings.ReplaceAll(aspect, ":", "x"))
	}
	return model
}

// ApplyImageModelResolutionTier translates a resolution alias into the fields
// understood by the selected upstream. An explicit WIDTHxHEIGHT size is the
// caller's authoritative output canvas and must never be replaced by a tier
// preset. Presets are only supplied when the caller used auto or a tier label.
func ApplyImageModelResolutionTier(request *dto.ImageRequest, originModel string) {
	if request == nil {
		return
	}

	originTier := imageModelResolutionTier(originModel)
	if originTier == "" {
		return
	}
	_, _, hasExplicitSize := parseImageSize(request.Size)
	resolution := strings.ToUpper(originTier)
	request.Resolution = &resolution
	if aspect, ok := imageModelResolutionAspect(originModel); ok {
		request.AspectRatio = &aspect
		if !hasExplicitSize {
			request.Size = imageTierSize(originTier, aspect)
		}
		return
	}
	if imageModelResolutionTier(request.Model) != originTier {
		if !hasExplicitSize {
			request.Size = originTier
		}
		return
	}
	if hasExplicitSize {
		return
	}

	orientation := imageSizeOrientation(request.Size)
	switch originTier {
	case "1k":
		switch orientation {
		case "landscape":
			request.Size = "1536x864"
		case "portrait":
			request.Size = "864x1536"
		default:
			request.Size = "1024x1024"
		}
	case "2k":
		switch orientation {
		case "landscape":
			request.Size = "2560x1440"
		case "portrait":
			request.Size = "1440x2560"
		default:
			request.Size = "2048x2048"
		}
	case "4k":
		switch orientation {
		case "square":
			request.Size = "2880x2880"
		case "portrait":
			request.Size = "2160x3840"
		default:
			request.Size = "3840x2160"
		}
	}
}

func imageModelResolutionTier(model string) string {
	normalizedModel := strings.ToLower(strings.TrimSpace(model))
	if aspect, ok := imageModelResolutionAspect(normalizedModel); ok {
		normalizedModel = strings.TrimSuffix(normalizedModel, "-"+strings.ReplaceAll(aspect, ":", "x"))
	}
	for _, tier := range []string{"1k", "2k", "4k"} {
		if strings.HasSuffix(normalizedModel, "-"+tier) {
			return tier
		}
	}
	return ""
}

func imageModelResolutionAspect(model string) (string, bool) {
	normalized := strings.ToLower(strings.TrimSpace(model))
	for _, supported := range []string{"1:1", "3:4", "4:3", "9:16", "16:9", "9:21", "21:9"} {
		if strings.HasSuffix(normalized, "-"+strings.ReplaceAll(supported, ":", "x")) {
			return supported, true
		}
	}
	return "", false
}

func imageTierSize(tier, aspect string) string {
	edge := map[string]int{"1k": 1024, "2k": 2048, "4k": 4096}[tier]
	if edge == 0 {
		return tier
	}
	parts := strings.Split(aspect, ":")
	if len(parts) != 2 {
		return tier
	}
	a, _ := strconv.Atoi(parts[0])
	b, _ := strconv.Atoi(parts[1])
	if a <= 0 || b <= 0 {
		return tier
	}
	scale := float64(edge) / float64(max(a, b))
	if tier == "4k" {
		const maxPixels = 8294400
		pixelScale := math.Sqrt(float64(maxPixels) / float64(a*b))
		scale = math.Min(scale, pixelScale)
	}
	width := int(math.Floor(float64(a)*scale/16)) * 16
	height := int(math.Floor(float64(b)*scale/16)) * 16
	if width <= 0 || height <= 0 {
		return tier
	}
	return fmt.Sprintf("%dx%d", width, height)
}

func classifyImageSize(size string) (string, string, bool) {
	width, height, ok := parseImageSize(size)
	if !ok {
		return "", "", false
	}
	maxEdge := max(width, height)
	tier := "4K"
	switch {
	case maxEdge <= 1024:
		tier = "1K"
	case maxEdge <= 2048:
		tier = "2K"
	}
	target := float64(width) / float64(height)
	bestAspect := "1:1"
	bestError := math.Inf(1)
	for _, candidate := range []struct {
		name  string
		ratio float64
	}{
		{"1:1", 1.0}, {"3:4", 3.0 / 4.0}, {"4:3", 4.0 / 3.0},
		{"9:16", 9.0 / 16.0}, {"16:9", 16.0 / 9.0},
		{"9:21", 9.0 / 21.0}, {"21:9", 21.0 / 9.0},
	} {
		error := math.Abs(math.Log(target / candidate.ratio))
		if error < bestError {
			bestError = error
			bestAspect = candidate.name
		}
	}
	return tier, bestAspect, true
}

func parseImageSize(size string) (int, int, bool) {
	parts := strings.Split(strings.ToLower(strings.TrimSpace(size)), "x")
	if len(parts) != 2 {
		return 0, 0, false
	}
	width, widthErr := strconv.Atoi(strings.TrimSpace(parts[0]))
	height, heightErr := strconv.Atoi(strings.TrimSpace(parts[1]))
	if widthErr != nil || heightErr != nil || width <= 0 || height <= 0 {
		return 0, 0, false
	}
	return width, height, true
}

func imageSizeOrientation(size string) string {
	parts := strings.Split(strings.ToLower(strings.TrimSpace(size)), "x")
	if len(parts) != 2 {
		return ""
	}
	width, widthErr := strconv.Atoi(strings.TrimSpace(parts[0]))
	height, heightErr := strconv.Atoi(strings.TrimSpace(parts[1]))
	if widthErr != nil || heightErr != nil || width <= 0 || height <= 0 {
		return ""
	}
	switch {
	case width > height:
		return "landscape"
	case height > width:
		return "portrait"
	default:
		return "square"
	}
}
