package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTokenFallbackGroupsPreserveOrderAcrossJSON(t *testing.T) {
	original := Token{}
	require.NoError(t, original.FallbackGroups.Set([]string{"backup-b", "backup-a"}))

	data, err := common.Marshal(original)
	require.NoError(t, err)
	assert.Contains(t, string(data), `"fallback_groups":["backup-b","backup-a"]`)

	var decoded Token
	require.NoError(t, common.Unmarshal(data, &decoded))
	assert.Equal(t, []string{"backup-b", "backup-a"}, decoded.FallbackGroups.Values())
}

func TestTokenFallbackGroupsExposeEmptyArrayForLegacyTokens(t *testing.T) {
	data, err := common.Marshal(Token{})
	require.NoError(t, err)
	assert.Contains(t, string(data), `"fallback_groups":[]`)
}
