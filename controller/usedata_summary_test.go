package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetUserUsageSummaryReturnsRolling24HoursForAuthenticatedUser(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	now := time.Now().Unix()
	require.NoError(t, model.LOG_DB.Create(&[]model.Log{
		{UserId: 7, CreatedAt: now - 60, Type: model.LogTypeConsume, Quota: 200, PromptTokens: 20, CompletionTokens: 10, Other: `{"group_ratio":2}`},
		{UserId: 7, CreatedAt: now - 25*60*60, Type: model.LogTypeConsume, Quota: 100, PromptTokens: 10, CompletionTokens: 5, Other: `{"group_ratio":1}`},
		{UserId: 8, CreatedAt: now - 60, Type: model.LogTypeConsume, Quota: 999, PromptTokens: 99, CompletionTokens: 99, Other: `{"group_ratio":1}`},
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 7)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/data/self/summary", nil)

	GetUserUsageSummary(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool                   `json:"success"`
		Data    model.UserUsageSummary `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	assert.Equal(t, int64(24*60*60), response.Data.WindowEnd-response.Data.WindowStart)
	assert.Equal(t, int64(200), response.Data.Last24Hours.Quota)
	assert.Equal(t, float64(100), response.Data.Last24Hours.OfficialQuota)
	assert.Equal(t, int64(300), response.Data.AllTime.Quota)
	assert.Equal(t, int64(2), response.Data.AllTime.Requests)
}

func TestGetUserUsageSummaryReturnsSiteWideDataForAdmin(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	now := time.Now().Unix()
	require.NoError(t, model.LOG_DB.Create(&[]model.Log{
		{UserId: 7, CreatedAt: now - 60, Type: model.LogTypeConsume, Quota: 200, PromptTokens: 20, CompletionTokens: 10, Other: `{"group_ratio":2}`},
		{UserId: 8, CreatedAt: now - 60, Type: model.LogTypeConsume, Quota: 300, PromptTokens: 30, CompletionTokens: 15, Other: `{"group_ratio":3}`},
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 7)
	ctx.Set("role", common.RoleAdminUser)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/data/self/summary", nil)

	GetUserUsageSummary(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool                   `json:"success"`
		Data    model.UserUsageSummary `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	assert.Equal(t, int64(500), response.Data.Last24Hours.Quota)
	assert.Equal(t, float64(200), response.Data.Last24Hours.OfficialQuota)
	assert.Equal(t, int64(2), response.Data.Last24Hours.Requests)
}
