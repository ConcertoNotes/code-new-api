package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestChannelAffinityReturnsToReenabledHigherPriority(t *testing.T) {
	previousDB := DB
	previousMemoryCache := common.MemoryCacheEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))
	DB = db
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		DB = previousDB
		common.MemoryCacheEnabled = previousMemoryCache
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})

	lowPriority := int64(1)
	highPriority := int64(3)
	channels := []Channel{
		{Id: 1, Name: "fallback", Key: "sk-low", Status: common.ChannelStatusEnabled, Group: "codex-pro", Models: "gpt-5", Priority: &lowPriority},
		{Id: 2, Name: "preferred", Key: "sk-high", Status: common.ChannelStatusManuallyDisabled, Group: "codex-pro", Models: "gpt-5", Priority: &highPriority},
	}
	require.NoError(t, db.Create(&channels).Error)
	abilities := []Ability{
		{Group: "codex-pro", Model: "gpt-5", ChannelId: 1, Enabled: true, Priority: &lowPriority},
		{Group: "codex-pro", Model: "gpt-5", ChannelId: 2, Enabled: false, Priority: &highPriority},
	}
	require.NoError(t, db.Create(&abilities).Error)
	InitChannelCache()

	assert.True(t, IsChannelHighestPriorityForGroupModel("codex-pro", "gpt-5", 1, "/v1/responses"))
	selected, err := GetRandomSatisfiedChannel("codex-pro", "gpt-5", 0, "/v1/responses")
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 1, selected.Id)

	require.NoError(t, db.Model(&Channel{}).Where("id = ?", 2).Update("status", common.ChannelStatusEnabled).Error)
	require.NoError(t, db.Model(&Ability{}).Where("channel_id = ?", 2).Update("enabled", true).Error)
	InitChannelCache()

	assert.False(t, IsChannelHighestPriorityForGroupModel("codex-pro", "gpt-5", 1, "/v1/responses"))
	assert.True(t, IsChannelHighestPriorityForGroupModel("codex-pro", "gpt-5", 2, "/v1/responses"))
	selected, err = GetRandomSatisfiedChannel("codex-pro", "gpt-5", 0, "/v1/responses")
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 2, selected.Id)

	common.MemoryCacheEnabled = false
	assert.False(t, IsChannelHighestPriorityForGroupModel("codex-pro", "gpt-5", 1, "/v1/responses"))
	assert.True(t, IsChannelHighestPriorityForGroupModel("codex-pro", "gpt-5", 2, "/v1/responses"))
}
