package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetUserUsageSummaryUsesExactRollingWindowAndConsumeLogs(t *testing.T) {
	truncateTables(t)

	logs := []Log{
		{UserId: 1, CreatedAt: 1000, Type: LogTypeConsume, Quota: 100, PromptTokens: 10, CompletionTokens: 5, Other: `{"group_ratio":1}`},
		{UserId: 1, CreatedAt: 2000, Type: LogTypeConsume, Quota: 200, PromptTokens: 20, CompletionTokens: 10, Other: `{"group_ratio":2}`},
		{UserId: 1, CreatedAt: 3000, Type: LogTypeRefund, Quota: 999, PromptTokens: 999, CompletionTokens: 999},
		{UserId: 2, CreatedAt: 3000, Type: LogTypeConsume, Quota: 400, PromptTokens: 40, CompletionTokens: 20},
		{UserId: 1, CreatedAt: 4001, Type: LogTypeConsume, Quota: 800, PromptTokens: 80, CompletionTokens: 40},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	summary, err := GetUserUsageSummary(1, 2000, 4000)
	require.NoError(t, err)

	assert.Equal(t, int64(2000), summary.WindowStart)
	assert.Equal(t, int64(4000), summary.WindowEnd)
	assert.Equal(t, UsageSummaryPeriod{
		Quota:         200,
		OfficialQuota: 100,
		Requests:      1,
		InputTokens:   20,
		OutputTokens:  10,
		TotalTokens:   30,
	}, summary.Last24Hours)
	assert.Equal(t, UsageSummaryPeriod{
		Quota:         300,
		OfficialQuota: 200,
		Requests:      2,
		InputTokens:   30,
		OutputTokens:  15,
		TotalTokens:   45,
	}, summary.AllTime)
}

func TestGetUserUsageSummaryPrefersRecordedOfficialQuotaAndSupportsSiteWideScope(t *testing.T) {
	truncateTables(t)

	logs := []Log{
		{UserId: 1, CreatedAt: 2000, Type: LogTypeConsume, Quota: 200, PromptTokens: 20, CompletionTokens: 10, Other: `{"group_ratio":2,"official_quota":750.5}`},
		{UserId: 2, CreatedAt: 3000, Type: LogTypeConsume, Quota: 400, PromptTokens: 40, CompletionTokens: 20, Other: `{"group_ratio":4}`},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	userSummary, err := GetUserUsageSummary(1, 1000, 4000)
	require.NoError(t, err)
	assert.Equal(t, float64(750.5), userSummary.Last24Hours.OfficialQuota)

	siteSummary, err := GetUserUsageSummary(0, 1000, 4000)
	require.NoError(t, err)
	assert.Equal(t, int64(600), siteSummary.Last24Hours.Quota)
	assert.Equal(t, float64(850.5), siteSummary.Last24Hours.OfficialQuota)
	assert.Equal(t, int64(2), siteSummary.Last24Hours.Requests)
	assert.Equal(t, int64(90), siteSummary.Last24Hours.TotalTokens)
}
