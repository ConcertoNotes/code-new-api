package billing_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPruneGroupBillingExprRemovesDeletedGroupOnly(t *testing.T) {
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.group_billing_expr": `{"deleted":{"GLM-5.2":"tier(\"deleted\", p * 4 + c * 14)"},"active":{"GLM-5.2":"tier(\"active\", p * 1 + c * 5)"}}`,
	}))

	value, changed, err := PruneGroupBillingExpr(map[string]float64{"active": 1})

	require.NoError(t, err)
	assert.True(t, changed)
	assert.JSONEq(t, `{"active":{"GLM-5.2":"tier(\"active\", p * 1 + c * 5)"}}`, value)
}

func TestPruneGroupBillingExprLeavesCurrentGroupsUnchanged(t *testing.T) {
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.group_billing_expr": `{"active":{"GLM-5.2":"tier(\"active\", p * 1 + c * 5)"}}`,
	}))

	value, changed, err := PruneGroupBillingExpr(map[string]float64{"active": 1})

	require.NoError(t, err)
	assert.False(t, changed)
	assert.Empty(t, value)
}
