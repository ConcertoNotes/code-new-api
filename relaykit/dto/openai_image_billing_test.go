package dto

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestResolveImageBillingTier(t *testing.T) {
	tests := []struct {
		name       string
		size       string
		resolution string
		prompt     string
		want       string
	}{
		{name: "cherry studio 1k", size: "1K", prompt: "portrait", want: "1K"},
		{name: "dimension below 1024 is 1k", size: "1023x1023", want: "1K"},
		{name: "dimension 1024 remains 1k", size: "1024x1024", want: "1K"},
		{name: "dimension above 1024 starts 2k", size: "1025x1024", want: "2K"},
		{name: "dimension 2k", size: "2048x1152", prompt: "portrait", want: "2K"},
		{name: "dimension above 2048 is 4k", size: "2049x1152", want: "4K"},
		{name: "dimension 4k", size: "3840x2160", prompt: "portrait", want: "4K"},
		{name: "resolution only", resolution: "4K", want: "4K"},
		{name: "size wins over resolution", size: "1536x1024", resolution: "4K", want: "2K"},
		{name: "prompt chinese", prompt: "请生成 1k 分辨率的图片", want: "1K"},
		{name: "prompt english", prompt: "Generate this image at 4K resolution", want: "4K"},
		{name: "structured wins", size: "2K", prompt: "Generate at 4K", want: "2K"},
		{name: "ambiguous prompt", prompt: "Compare 1K and 4K output", want: "2K"},
		{name: "default", size: "auto", prompt: "portrait", want: "2K"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, ResolveImageBillingTierWithResolution(tt.size, tt.resolution, tt.prompt))
		})
	}
}

func TestImageRequestTokenMetaCarriesBillingTierAndCount(t *testing.T) {
	n := uint(3)
	resolution := "4K"
	meta := (&ImageRequest{Resolution: &resolution, Prompt: "Generate an image", N: &n}).GetTokenCountMeta()

	assert.Equal(t, "4K", meta.ImageBillingTier)
	assert.Equal(t, 3.0, meta.BillingRatios["n"])
}

func TestImageRequestTokenMetaPrefersSizeOverResolution(t *testing.T) {
	resolution := "4K"
	meta := (&ImageRequest{Size: "1536x1024", Resolution: &resolution}).GetTokenCountMeta()

	assert.Equal(t, "2K", meta.ImageBillingTier)
}
