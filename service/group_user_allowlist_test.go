package service

import (
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func configureGroupUserAllowlistTest(t *testing.T) {
	t.Helper()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	originalRatios := ratio_setting.GroupRatio2JSONString()
	originalAutoGroups := setting.AutoGroups2JsonString()
	allowlist := ratio_setting.GetGroupRatioSetting().GroupUserAllowlist
	originalAllowlist := allowlist.ReadAll()

	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","private":"Private"}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"private":1}`))
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["private","default"]`))
	allowlist.Clear()
	allowlist.Set("private", []int{42})

	t.Cleanup(func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(originalAutoGroups))
		allowlist.Clear()
		allowlist.AddAll(originalAllowlist)
	})
}

func TestGetUserUsableGroupsUserAllowlistOverridesGlobalVisibility(t *testing.T) {
	configureGroupUserAllowlistTest(t)

	allowedGroups := GetUserUsableGroups(42, "default")
	deniedGroups := GetUserUsableGroups(7, "default")

	assert.Contains(t, allowedGroups, "private")
	assert.NotContains(t, deniedGroups, "private")
	assert.True(t, IsUserSelectableGroup(42, "default", "private"))
	assert.False(t, IsUserSelectableGroup(7, "default", "private"))
	assert.Equal(t, []string{"private", "default"}, GetUserAutoGroup(42, "default"))
	assert.Equal(t, []string{"default"}, GetUserAutoGroup(7, "default"))
}

func TestGetUserUsableGroupsAllowlistGrantsNonGlobalGroup(t *testing.T) {
	configureGroupUserAllowlistTest(t)
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default"}`))

	assert.Contains(t, GetUserUsableGroups(42, "default"), "private")
	assert.NotContains(t, GetUserUsableGroups(7, "default"), "private")
}

func TestRestrictedOwnUserGroupDoesNotBypassAllowlist(t *testing.T) {
	configureGroupUserAllowlistTest(t)

	assert.Contains(t, GetUserUsableGroups(42, "private"), "private")
	assert.NotContains(t, GetUserUsableGroups(7, "private"), "private")
}
