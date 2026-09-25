package model

import (
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

const userVisibleGroupsOptionKey = "group_ratio_setting.user_visible_groups"

var userVisibleGroupsMutex sync.Mutex

// SetUserVisibleGroups stores the exact groups a user may see and use.
// An empty list removes the restriction so the default visibility rules apply.
func SetUserVisibleGroups(userID int, groups []string) error {
	userVisibleGroupsMutex.Lock()
	defer userVisibleGroupsMutex.Unlock()

	visibleGroups := ratio_setting.GetGroupRatioSetting().UserVisibleGroups.ReadAll()
	if len(groups) == 0 {
		delete(visibleGroups, userID)
	} else {
		visibleGroups[userID] = groups
	}
	data, err := common.Marshal(visibleGroups)
	if err != nil {
		return err
	}
	return UpdateOption(userVisibleGroupsOptionKey, string(data))
}
