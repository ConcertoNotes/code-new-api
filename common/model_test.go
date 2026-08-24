package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsImageGenerationModelRecognizesGPTImageFamily(t *testing.T) {
	tests := []struct {
		name  string
		model string
		want  bool
	}{
		{name: "GPT Image 1", model: "gpt-image-1", want: true},
		{name: "GPT Image 2", model: "gpt-image-2", want: true},
		{name: "GPT Image 2 resolution alias", model: "gpt-image-2-4k", want: true},
		{name: "case insensitive", model: "GPT-IMAGE-2", want: true},
		{name: "text model", model: "gpt-5.4", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, IsImageGenerationModel(tt.model))
		})
	}
}

func TestPublicImageModelNameCollapsesInternalVariants(t *testing.T) {
	tests := []struct {
		name  string
		model string
		want  string
	}{
		{name: "resolution and aspect", model: "gpt-image-2-4k-16x9", want: "gpt-image-2"},
		{name: "resolution only", model: "gpt-image-2-2k", want: "gpt-image-2"},
		{name: "ordinary model", model: "gpt-4.1", want: "gpt-4.1"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, PublicImageModelName(tt.model))
		})
	}
}

func TestCollapseImageModelVariantsDeduplicatesPublicNames(t *testing.T) {
	got := CollapseImageModelVariants([]string{"gpt-image-2-4k-16x9", "gpt-image-2", "gpt-4.1", "gpt-image-2-2k"})
	want := []string{"gpt-image-2", "gpt-4.1"}
	assert.Equal(t, want, got)
}
