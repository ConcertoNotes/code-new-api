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
