package service

import (
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupFallbackChannelSelectionTest(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := model.DB
	previousMemoryCache := common.MemoryCacheEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))
	model.DB = db
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		model.DB = previousDB
		common.MemoryCacheEnabled = previousMemoryCache
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func createFallbackSelectionChannel(t *testing.T, db *gorm.DB, id int, group string) {
	t.Helper()
	priority := int64(0)
	require.NoError(t, db.Create(&model.Channel{
		Id:     id,
		Name:   group,
		Key:    "sk-test",
		Status: common.ChannelStatusEnabled,
		Group:  group,
		Models: "test-model",
	}).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     group,
		Model:     "test-model",
		ChannelId: id,
		Enabled:   true,
		Priority:  &priority,
	}).Error)
}

func newFallbackSelectionContext(fallbackGroups []string) *gin.Context {
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyTokenFallbackGroups, fallbackGroups)
	return ctx
}

func TestFallbackChannelSelectionUsesConfiguredOrder(t *testing.T) {
	db := setupFallbackChannelSelectionTest(t)
	createFallbackSelectionChannel(t, db, 1, "backup-first")
	createFallbackSelectionChannel(t, db, 2, "backup-second")
	model.InitChannelCache()
	ctx := newFallbackSelectionContext([]string{"backup-first", "backup-second"})

	channel, selectedGroup, err := CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx:        ctx,
		TokenGroup: "primary",
		ModelName:  "test-model",
		Retry:      common.GetPointer(0),
	})

	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, 1, channel.Id)
	assert.Equal(t, "backup-first", selectedGroup)
}

func TestFallbackChannelSelectionMovesAfterGroupRetriesAreExhausted(t *testing.T) {
	db := setupFallbackChannelSelectionTest(t)
	createFallbackSelectionChannel(t, db, 1, "primary")
	createFallbackSelectionChannel(t, db, 2, "backup")
	model.InitChannelCache()
	ctx := newFallbackSelectionContext([]string{"backup"})
	previousRetryTimes := common.RetryTimes
	common.RetryTimes = 0
	t.Cleanup(func() { common.RetryTimes = previousRetryTimes })
	param := &RetryParam{
		Ctx:        ctx,
		TokenGroup: "primary",
		ModelName:  "test-model",
		Retry:      common.GetPointer(0),
	}

	firstChannel, firstGroup, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, firstChannel)
	assert.Equal(t, "primary", firstGroup)

	param.IncreaseRetry()
	secondChannel, secondGroup, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, secondChannel)
	assert.Equal(t, 2, secondChannel.Id)
	assert.Equal(t, "backup", secondGroup)
}

func TestChannelSelectionExcludesPreviouslyUsedChannelOnRetry(t *testing.T) {
	db := setupFallbackChannelSelectionTest(t)
	createFallbackSelectionChannel(t, db, 1, "primary")
	createFallbackSelectionChannel(t, db, 2, "primary")
	model.InitChannelCache()
	ctx := newFallbackSelectionContext(nil)
	param := &RetryParam{
		Ctx:        ctx,
		TokenGroup: "primary",
		ModelName:  "test-model",
		Retry:      common.GetPointer(0),
	}

	firstChannel, _, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, firstChannel)
	ctx.Set("use_channel", []string{fmt.Sprintf("%d", firstChannel.Id)})

	param.IncreaseRetry()
	secondChannel, _, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, secondChannel)
	assert.NotEqual(t, firstChannel.Id, secondChannel.Id)
}

func TestValidateTokenFallbackGroupsRejectsInvalidStructure(t *testing.T) {
	tests := []struct {
		name           string
		primaryGroup   string
		fallbackGroups []string
	}{
		{name: "auto primary", primaryGroup: "auto", fallbackGroups: []string{"backup"}},
		{name: "too many groups", primaryGroup: "primary", fallbackGroups: []string{"a", "b", "c", "d", "e", "f", "g", "h", "i"}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Error(t, ValidateTokenFallbackGroups(0, "default", test.primaryGroup, test.fallbackGroups))
		})
	}
}
