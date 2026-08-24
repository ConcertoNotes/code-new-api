package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenAIVideoDefaultEndpoint(t *testing.T) {
	info, ok := GetDefaultEndpointInfo(constant.EndpointTypeOpenAIVideo)
	require.True(t, ok)
	assert.Equal(t, "/v1/videos", info.Path)
	assert.Equal(t, "POST", info.Method)

	info, ok = GetDefaultEndpointInfo(constant.EndpointTypeVideoGeneration)
	require.True(t, ok)
	assert.Equal(t, "/v1/video/generations", info.Path)
	assert.Equal(t, "POST", info.Method)
}
