package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestVideoGenerationPriceConfiguration(t *testing.T) {
	saved := VideoGenerationPrice2JSONString()
	t.Cleanup(func() { require.NoError(t, UpdateVideoGenerationPriceByJSONString(saved)) })

	require.NoError(t, UpdateVideoGenerationPriceByJSONString(`{"seedance-2.0":{"480P":0.2,"720P":0.4,"1080p":0.7,"4K":1.2,"768P":0.5}}`))
	price, ok := GetVideoGenerationPrice("seedance-2.0", "854x480")
	require.True(t, ok)
	assert.Equal(t, 0.2, price)
	price, ok = GetVideoGenerationPrice("seedance-2.0", "1280x720")
	require.True(t, ok)
	assert.Equal(t, 0.4, price)
	price, ok = GetVideoGenerationPrice("seedance-2.0", "1920x1080")
	require.True(t, ok)
	assert.Equal(t, 0.7, price)
	price, ok = GetVideoGenerationPrice("seedance-2.0", "2160x3840")
	require.True(t, ok)
	assert.Equal(t, 1.2, price)
	price, ok = GetVideoGenerationPrice("seedance-2.0", " 768p ")
	require.True(t, ok)
	assert.Equal(t, 0.5, price)
}

func TestVideoGenerationPriceRejectsInvalidConfiguration(t *testing.T) {
	assert.Error(t, UpdateVideoGenerationPriceByJSONString(`{"seedance-2.0":{" ":0.4}}`))
	assert.Error(t, UpdateVideoGenerationPriceByJSONString(`{"seedance-2.0":{"720p":-0.1}}`))
	assert.Error(t, UpdateVideoGenerationPriceByJSONString(`{"seedance-2.0":{"720p":0.4,"1280x720":0.5}}`))
	assert.Error(t, ValidateVideoGenerationPriceJSON(`{"":{"720p":0.4}}`))
}

func TestVideoGenerationPriceDoesNotMatchSimilarModelNames(t *testing.T) {
	saved := VideoGenerationPrice2JSONString()
	t.Cleanup(func() { require.NoError(t, UpdateVideoGenerationPriceByJSONString(saved)) })

	require.NoError(t, UpdateVideoGenerationPriceByJSONString(`{"gpt-4-gizmo-*":{"720p":0.7}}`))

	price, ok := GetVideoGenerationPrice("gpt-4-gizmo-custom", "720p")
	assert.False(t, ok)
	assert.Zero(t, price)
}

func TestVideoGenerationPriceForModelsUsesFirstConfiguredName(t *testing.T) {
	saved := VideoGenerationPrice2JSONString()
	t.Cleanup(func() { require.NoError(t, UpdateVideoGenerationPriceByJSONString(saved)) })

	require.NoError(t, UpdateVideoGenerationPriceByJSONString(
		`{"upstream-video":{"720p":0.4}}`,
	))

	price, ok := GetVideoGenerationPriceForModels([]string{"public-video", "upstream-video"}, "1280x720")
	require.True(t, ok)
	assert.Equal(t, 0.4, price)
}
