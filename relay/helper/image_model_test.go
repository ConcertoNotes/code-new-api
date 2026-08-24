package helper

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestResolveImageModelVariant(t *testing.T) {
	tests := []struct {
		name  string
		model string
		size  string
		want  string
	}{
		{name: "below 1024 is 1k", model: "image-model", size: "1023x1023", want: "image-model-1k-1x1"},
		{name: "1024 remains 1k", model: "image-model", size: "1024x1024", want: "image-model-1k-1x1"},
		{name: "1025 starts 2k", model: "image-model", size: "1025x1025", want: "image-model-2k-1x1"},
		{name: "2048 remains 2k", model: "image-model", size: "2048x1536", want: "image-model-2k-4x3"},
		{name: "2049 starts 4k", model: "image-model", size: "2049x2049", want: "image-model-4k-1x1"},
		{name: "4096 ultrawide", model: "image-model", size: "4096x1755", want: "image-model-4k-21x9"},
		{name: "oversized clamps to 4k route", model: "image-model", size: "8192x4608", want: "image-model-4k-16x9"},
		{name: "nonstandard ratio uses nearest supported ratio", model: "image-model", size: "1200x1000", want: "image-model-2k-4x3"},
		{name: "portrait ratio", model: "image-model", size: "1000x1600", want: "image-model-2k-9x16"},
		{name: "existing tier keeps tier and adds ratio", model: "image-model-4k", size: "2048x1536", want: "image-model-4k-4x3"},
		{name: "resolved alias is stable", model: "image-model-4k-16x9", size: "1024x1024", want: "image-model-4k-16x9"},
		{name: "invalid size preserves model", model: "image-model", size: "wide", want: "image-model"},
		{name: "auto preserves model", model: "image-model", size: "auto", want: "image-model"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, ResolveImageModelVariant(tt.model, tt.size))
		})
	}
}

func TestBaseImageModel(t *testing.T) {
	assert.Equal(t, "image-model", BaseImageModel("image-model-4k-16x9"))
	assert.Equal(t, "image-model", BaseImageModel("image-model-4k"))
	assert.Equal(t, "image-model-4k", ImageModelTierVariant("image-model-4k-16x9"))
}

func TestImageModelSelectionCandidates(t *testing.T) {
	assert.Equal(t, []string{
		"image-model-4k-16x9",
		"image-model-4k",
		"image-model",
	}, ImageModelSelectionCandidates("image-model", "4096x2304"))
	assert.Equal(t, []string{"image-model"}, ImageModelSelectionCandidates("image-model", "auto"))
	assert.Equal(t, []string{
		"image-model-2k-4x3",
		"image-model-2k",
		"image-model",
	}, ImageModelSelectionCandidatesWithOptions("image-model", "1536x1024", "4K", "16:9"))
	assert.Equal(t, []string{
		"image-model-4k-3x4",
		"image-model-4k",
		"image-model",
	}, ImageModelSelectionCandidatesWithOptions("image-model", "2240x3168", "2K", "1:1"))
	assert.Equal(t, []string{
		"image-model-2k-4x3",
		"image-model-2k",
		"image-model",
	}, ImageModelSelectionCandidatesWithOptions("image-model", "auto", "2k", "4x3"))
	assert.Equal(t, []string{
		"image-model-4k-16x9",
		"image-model-4k",
		"image-model",
	}, ImageModelSelectionCandidatesWithOptions("image-model", "4k", "", "16:9"))
	assert.Equal(t, []string{
		"image-model-4k-4x3",
		"image-model-4k",
		"image-model",
	}, ImageModelSelectionCandidatesWithOptions("image-model-4k", "2048x1536", "", ""))
}

func TestResolveImageRequestTierPrefersSize(t *testing.T) {
	tests := []struct {
		name       string
		size       string
		resolution string
		want       string
	}{
		{name: "size only 1k", size: "1024x768", want: "1K"},
		{name: "size only 2k", size: "1536x1024", want: "2K"},
		{name: "size only 4k", size: "2240x3168", want: "4K"},
		{name: "resolution only", resolution: "4k", want: "4K"},
		{name: "size wins over resolution", size: "1536x1024", resolution: "4K", want: "2K"},
		{name: "tier size wins over resolution", size: "1K", resolution: "4K", want: "1K"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, ResolveImageRequestTier(tt.size, tt.resolution))
		})
	}
}

func TestResolveImageRequestSizeSupportsCherryStudioPromptDimensions(t *testing.T) {
	tests := []struct {
		name   string
		size   string
		prompt string
		want   string
	}{
		{name: "default size is replaced by labelled chinese dimensions", size: "1024x1024", prompt: "生成一张樱花照片，大小为2240x3168", want: "2240x3168"},
		{name: "unicode multiplication sign is accepted", size: "1024x1024", prompt: "生成海报，尺寸：2240×3168", want: "2240x3168"},
		{name: "english dimensions are accepted", size: "auto", prompt: "Create a poster, dimensions 2240x3168", want: "2240x3168"},
		{name: "unlabelled numbers are ignored", size: "1024x1024", prompt: "The artwork contains 2240x3168 as text", want: "1024x1024"},
		{name: "custom structured size remains authoritative", size: "1600x1200", prompt: "大小为2240x3168", want: "1600x1200"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, ResolveImageRequestSize(tt.size, tt.prompt))
		})
	}
}

func TestImageTierSizeSupportsCanonicalAspectRatios(t *testing.T) {
	tests := map[string]string{
		"1:1":  "2048x2048",
		"3:4":  "1536x2048",
		"4:3":  "2048x1536",
		"9:16": "1152x2048",
		"16:9": "2048x1152",
		"9:21": "864x2048",
		"21:9": "2048x864",
	}
	for aspect, want := range tests {
		t.Run(aspect, func(t *testing.T) {
			assert.Equal(t, want, imageTierSize("2k", aspect))
		})
	}
}

func TestImageTierSizeBounds4KToProviderPixelLimit(t *testing.T) {
	tests := map[string]string{
		"1:1":  "2880x2880",
		"3:4":  "2480x3312",
		"4:3":  "3312x2480",
		"9:16": "2160x3840",
		"16:9": "3840x2160",
	}
	for aspect, want := range tests {
		t.Run(aspect, func(t *testing.T) {
			assert.Equal(t, want, imageTierSize("4k", aspect))
		})
	}
}
