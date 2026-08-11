package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
)

func TestApplyImageModelResolutionTier(t *testing.T) {
	tests := []struct {
		name     string
		model    string
		size     string
		wantSize string
	}{
		{name: "4k alias overrides client size", model: "gpt-image-2-4k", size: "1024x1024", wantSize: "4k"},
		{name: "2k alias", model: "gpt-image-2-2K", size: "auto", wantSize: "2k"},
		{name: "1k alias", model: "gpt-image-2-1k", wantSize: "1k"},
		{name: "ordinary model preserves size", model: "gpt-image-2", size: "1024x1536", wantSize: "1024x1536"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := &dto.ImageRequest{Model: tt.model, Size: tt.size}
			applyImageModelResolutionTier(request)
			assert.Equal(t, tt.wantSize, request.Size)
		})
	}
}
