package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSaveGroupRatioWithRenamesUpdatesChannelsUsersAndTokens(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Option{}))
	require.NoError(t, DB.Exec("DELETE FROM options").Error)

	previousOptions := common.OptionMap
	previousGroupRatio := ratio_setting.GroupRatio2JSONString()
	previousUsable := setting.UserUsableGroups2JSONString()
	previousAuto := setting.AutoGroups2JsonString()
	t.Cleanup(func() {
		common.OptionMap = previousOptions
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(previousGroupRatio))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(previousUsable))
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(previousAuto))
	})
	common.OptionMap = map[string]string{}
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":1}`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP"}`))
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["default","vip"]`))

	channel := Channel{
		Name:   "rename-channel",
		Key:    "key",
		Status: common.ChannelStatusEnabled,
		Models: "gpt-4",
		Group:  "vip,default",
	}
	require.NoError(t, channel.Insert())

	user := User{
		Username:    "rename-user",
		Password:    "unused-password-hash",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "vip",
		AuthVersion: 1,
		AffCode:     "rename-aff",
	}
	require.NoError(t, DB.Create(&user).Error)

	token := Token{
		UserId: user.Id,
		Key:    "rename-token-key",
		Name:   "rename-token",
		Status: common.TokenStatusEnabled,
		Group:  "vip",
	}
	require.NoError(t, token.SetAutoGroups([]string{"vip", "default"}))
	require.NoError(t, token.FallbackGroups.Set([]string{"vip"}))
	require.NoError(t, token.Insert())

	require.NoError(t, SaveGroupRatioWithRenames(`{"default":1,"gold":1}`, map[string]string{"vip": "gold"}))

	var storedChannel Channel
	require.NoError(t, DB.First(&storedChannel, channel.Id).Error)
	assert.Equal(t, "gold,default", storedChannel.Group)

	var abilities []Ability
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).Find(&abilities).Error)
	require.Len(t, abilities, 2)
	groups := []string{abilities[0].Group, abilities[1].Group}
	assert.ElementsMatch(t, []string{"gold", "default"}, groups)

	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, "gold", storedUser.Group)

	var storedToken Token
	require.NoError(t, DB.First(&storedToken, token.Id).Error)
	assert.Equal(t, "gold", storedToken.Group)
	assert.Equal(t, []string{"gold"}, storedToken.FallbackGroups.Values())
	autoGroups, err := storedToken.GetAutoGroups()
	require.NoError(t, err)
	assert.Equal(t, []string{"gold", "default"}, autoGroups)

	assert.True(t, ratio_setting.ContainsGroupRatio("gold"))
	assert.False(t, ratio_setting.ContainsGroupRatio("vip"))
	usable := setting.GetUserUsableGroupsCopy()
	_, hasVIP := usable["vip"]
	_, hasGold := usable["gold"]
	assert.False(t, hasVIP)
	assert.True(t, hasGold)
	assert.Equal(t, []string{"default", "gold"}, setting.GetAutoGroups())
}
