package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
)

func TestNormalizeChannelTestEndpointDetectsGPTImageModels(t *testing.T) {
	tests := []struct {
		name         string
		model        string
		endpointType string
		want         string
	}{
		{
			name:  "base model",
			model: "gpt-image-2",
			want:  string(constant.EndpointTypeImageGeneration),
		},
		{
			name:  "resolution alias",
			model: "gpt-image-2-4k",
			want:  string(constant.EndpointTypeImageGeneration),
		},
		{
			name:         "explicit endpoint takes precedence",
			model:        "gpt-image-2",
			endpointType: string(constant.EndpointTypeOpenAI),
			want:         string(constant.EndpointTypeOpenAI),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, normalizeChannelTestEndpoint(nil, tt.model, tt.endpointType))
		})
	}
}
