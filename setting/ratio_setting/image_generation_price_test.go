package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestImageGenerationPriceConfiguration(t *testing.T) {
	saved := ImageGenerationPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, UpdateImageGenerationPriceByJSONString(saved))
	})

	require.NoError(t, UpdateImageGenerationPriceByJSONString(`{"image-model":{"1k":0.05,"2K":0.1,"4K":0.2}}`))

	price, ok := GetImageGenerationPrice("image-model", "1K")
	require.True(t, ok)
	assert.Equal(t, 0.05, price)

	price, ok = GetImageGenerationPrice("image-model", "4k")
	require.True(t, ok)
	assert.Equal(t, 0.2, price)
}

func TestImageGenerationPriceRejectsInvalidConfiguration(t *testing.T) {
	tests := []string{
		`{"image-model":{"8K":0.4}}`,
		`{"image-model":{"1K":-0.1}}`,
		`{"":{"1K":0.1}}`,
	}

	for _, input := range tests {
		assert.Error(t, UpdateImageGenerationPriceByJSONString(input))
	}
}
