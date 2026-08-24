package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
)

func TestApplyImageModelResolutionTier(t *testing.T) {
	tests := []struct {
		name          string
		originModel   string
		upstreamModel string
		size          string
		wantSize      string
	}{
		{
			name:          "automatic 2k widescreen alias preserves explicit dimensions",
			originModel:   "gpt-image-2-2k-16x9",
			upstreamModel: "gpt-image-2",
			size:          "1500x900",
			wantSize:      "1500x900",
		},
		{
			name:          "automatic 4k ultrawide alias preserves explicit dimensions",
			originModel:   "gpt-image-2-4k-21x9",
			upstreamModel: "gpt-image-2",
			size:          "3500x1400",
			wantSize:      "3500x1400",
		},
		{
			name:          "mapped 4k alias preserves explicit dimensions",
			originModel:   "gpt-image-2-4k",
			upstreamModel: "gpt-image-2",
			size:          "1024x1024",
			wantSize:      "1024x1024",
		},
		{
			name:          "mapped 2k alias is case insensitive",
			originModel:   "gpt-image-2-2K",
			upstreamModel: "gpt-image-2",
			size:          "auto",
			wantSize:      "2k",
		},
		{
			name:          "native 4k alias preserves explicit square dimensions",
			originModel:   "gpt-image-2-4k",
			upstreamModel: "gpt-image-2-4k",
			size:          "1024x1024",
			wantSize:      "1024x1024",
		},
		{
			name:          "native 4k alias preserves explicit landscape dimensions",
			originModel:   "gpt-image-2-4k",
			upstreamModel: "vendor-image-4k",
			size:          "1536x1024",
			wantSize:      "1536x1024",
		},
		{
			name:          "native 4k alias preserves explicit portrait dimensions",
			originModel:   "gpt-image-2-4k",
			upstreamModel: "gpt-image-2-4k",
			size:          "1024x1536",
			wantSize:      "1024x1536",
		},
		{
			name:          "native 2k alias preserves explicit portrait dimensions",
			originModel:   "gpt-image-2-2k",
			upstreamModel: "gpt-image-2-2k",
			size:          "1024x1536",
			wantSize:      "1024x1536",
		},
		{
			name:          "native 4k alias defaults to landscape",
			originModel:   "gpt-image-2-4k",
			upstreamModel: "gpt-image-2-4k",
			size:          "auto",
			wantSize:      "3840x2160",
		},
		{
			name:          "ordinary model preserves size",
			originModel:   "gpt-image-2",
			upstreamModel: "gpt-image-2",
			size:          "1024x1536",
			wantSize:      "1024x1536",
		},
		{
			name:          "base model preserves valid custom portrait size",
			originModel:   "gpt-image-2",
			upstreamModel: "gpt-image-2",
			size:          "2240x3168",
			wantSize:      "2240x3168",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := &dto.ImageRequest{Model: tt.upstreamModel, Size: tt.size}
			helper.ApplyImageModelResolutionTier(request, tt.originModel)
			assert.Equal(t, tt.wantSize, request.Size)
		})
	}
}
