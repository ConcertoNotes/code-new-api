package controller

import (
	"context"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeChannelTestEndpointDetectsSpecializedModels(t *testing.T) {
	tests := []struct {
		name         string
		model        string
		endpointType string
		want         string
	}{
		{
			name:  "base image model",
			model: "gpt-image-2",
			want:  string(constant.EndpointTypeImageGeneration),
		},
		{
			name:  "image resolution alias",
			model: "gpt-image-2-4k",
			want:  string(constant.EndpointTypeImageGeneration),
		},
		{
			name:  "Seedance video model",
			model: "seedance-2-0",
			want:  string(constant.EndpointTypeOpenAIVideo),
		},
		{
			name:         "explicit endpoint takes precedence",
			model:        "seedance-2-0",
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

func TestNormalizeChannelTestEndpointDetectsConfiguredVideoPrice(t *testing.T) {
	savedVideoPrices := ratio_setting.VideoGenerationPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateVideoGenerationPriceByJSONString(savedVideoPrices))
	})
	require.NoError(t, ratio_setting.UpdateVideoGenerationPriceByJSONString(
		`{"custom-video-model":{"720p":0.4}}`,
	))

	assert.Equal(t,
		string(constant.EndpointTypeOpenAIVideo),
		normalizeChannelTestEndpoint(nil, "custom-video-model", ""),
	)
}

func TestVideoChannelTestsStopBeforeAnyUpstreamRequest(t *testing.T) {
	tests := []string{
		string(constant.EndpointTypeOpenAIVideo),
		string(constant.EndpointTypeVideoGeneration),
	}

	for _, endpointType := range tests {
		t.Run(endpointType, func(t *testing.T) {
			baseURL := "http://127.0.0.1:1"
			channel := &model.Channel{
				Type:    constant.ChannelTypeOpenAI,
				BaseURL: &baseURL,
			}
			result := testChannel(
				context.Background(),
				channel,
				0,
				"seedance-2-0",
				endpointType,
				false,
			)

			require.Error(t, result.localErr)
			assert.Contains(t, strings.ToLower(result.localErr.Error()), "manual request")
			assert.Nil(t, result.newAPIError)
		})
	}
}
