package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTokenFallbackGroupsRoundTripThroughRedisHashCache(t *testing.T) {
	useUserCacheMiniRedis(t)
	token := Token{
		Id:     43,
		UserId: 7,
		Key:    "token-fallback-groups-cache-key",
		Name:   "fallback-cache",
		Group:  "primary",
	}
	require.NoError(t, token.FallbackGroups.Set([]string{"backup-b", "backup-a"}))

	require.NoError(t, cacheSetTokenForTest(token))
	cached, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, []string{"backup-b", "backup-a"}, cached.FallbackGroups.Values())
}

func TestTokenUpdateReloadsFallbackGroupsAfterRedisFence(t *testing.T) {
	truncateTables(t)
	server := useUserCacheMiniRedis(t)
	token := Token{
		UserId:         7,
		Key:            "token-fallback-groups-update-cache-key",
		Name:           "fallback-cache-update",
		Status:         common.TokenStatusEnabled,
		ExpiredTime:    -1,
		UnlimitedQuota: true,
		Group:          "primary",
	}
	require.NoError(t, token.FallbackGroups.Set([]string{"backup-b", "backup-a"}))
	require.NoError(t, token.Insert())
	require.NoError(t, cacheSetTokenForTest(token))

	preheated, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, []string{"backup-b", "backup-a"}, preheated.FallbackGroups.Values())

	require.NoError(t, token.FallbackGroups.Set([]string{"backup-a", "backup-c"}))
	require.NoError(t, token.Update())
	_, cacheErr := cacheGetTokenByKey(token.Key)
	require.Error(t, cacheErr, "the pre-update fallback groups must be invalidated")

	reloaded, err := GetTokenByKey(token.Key, false)
	require.NoError(t, err)
	assert.Equal(t, []string{"backup-a", "backup-c"}, reloaded.FallbackGroups.Values())
	_, cacheErr = cacheGetTokenByKey(token.Key)
	require.Error(t, cacheErr, "the database read must not repopulate the cache while fenced")

	server.FastForward(time.Duration(tokenCacheFenceSeconds+1) * time.Second)
	reloaded, err = GetTokenByKey(token.Key, false)
	require.NoError(t, err)
	assert.Equal(t, []string{"backup-a", "backup-c"}, reloaded.FallbackGroups.Values())
	cached, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, []string{"backup-a", "backup-c"}, cached.FallbackGroups.Values())
}

func TestTokenAutoGroupsRoundTripThroughRedisHashCache(t *testing.T) {
	useUserCacheMiniRedis(t)
	token := Token{
		Id:         42,
		UserId:     7,
		Key:        "token-auto-groups-cache-key",
		Name:       "auto-cache",
		Group:      "auto",
		AutoGroups: `["vip","default"]`,
	}

	require.NoError(t, cacheSetTokenForTest(token))
	cached, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, token.AutoGroups, cached.AutoGroups)
	groups, err := cached.GetAutoGroups()
	require.NoError(t, err)
	assert.Equal(t, []string{"vip", "default"}, groups)
}

func TestTokenUpdateSynchronouslyNarrowsPreheatedAutoGroupsCache(t *testing.T) {
	truncateTables(t)
	useUserCacheMiniRedis(t)
	token := Token{
		UserId:          7,
		Key:             "token-auto-groups-update-cache-key",
		Name:            "auto-cache-update",
		Status:          common.TokenStatusEnabled,
		ExpiredTime:     -1,
		UnlimitedQuota:  true,
		Group:           "auto",
		CrossGroupRetry: true,
		AutoGroups:      `["default","vip"]`,
	}
	require.NoError(t, token.Insert())
	require.NoError(t, cacheSetTokenForTest(token))

	preheated, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.JSONEq(t, `["default","vip"]`, preheated.AutoGroups)

	require.NoError(t, token.SetAutoGroups([]string{"vip"}))
	require.NoError(t, token.Update())
	// Update 是限制性变更：写库前删除缓存并设置 fence。缓存不再提供旧的
	// 宽分组值，下一次读取必须看到收紧后的分组。
	_, cacheErr := cacheGetTokenByKey(token.Key)
	require.Error(t, cacheErr, "the pre-update cache entry must be invalidated")
	reloaded, err := GetTokenByKey(token.Key, false)
	require.NoError(t, err)
	assert.JSONEq(t, `["vip"]`, reloaded.AutoGroups)
}

// cacheSetTokenForTest 以测试身份写入完整 token 缓存（含额度字段），
// 模拟“已水合”的缓存状态。
func cacheSetTokenForTest(token Token) error {
	_, err := cacheInitToken(token)
	return err
}
