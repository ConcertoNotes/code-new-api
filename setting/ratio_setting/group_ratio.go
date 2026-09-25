package ratio_setting

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/types"
)

var defaultGroupRatio = map[string]float64{
	"default": 1,
	"vip":     1,
	"svip":    1,
}

var groupRatioMap = types.NewRWMap[string, float64]()

var defaultGroupGroupRatio = map[string]map[string]float64{
	"vip": {
		"edit_this": 0.9,
	},
}

var groupGroupRatioMap = types.NewRWMap[string, map[string]float64]()

var defaultGroupSpecialUsableGroup = map[string]map[string]string{}
var defaultGroupUserAllowlist = map[string][]int{}
var defaultUserVisibleGroups = map[int][]string{}

type GroupRatioSetting struct {
	GroupRatio              *types.RWMap[string, float64]            `json:"group_ratio"`
	GroupGroupRatio         *types.RWMap[string, map[string]float64] `json:"group_group_ratio"`
	GroupSpecialUsableGroup *types.RWMap[string, map[string]string]  `json:"group_special_usable_group"`
	GroupUserAllowlist      *types.RWMap[string, []int]              `json:"group_user_allowlist"`
	// UserVisibleGroups maps a user ID to the exact groups that user may see and use.
	// Users without an entry keep the default group visibility rules.
	UserVisibleGroups       *types.RWMap[int, []string]              `json:"user_visible_groups"`
}

var groupRatioSetting GroupRatioSetting

func init() {
	groupSpecialUsableGroup := types.NewRWMap[string, map[string]string]()
	groupSpecialUsableGroup.AddAll(defaultGroupSpecialUsableGroup)
	groupUserAllowlist := types.NewRWMap[string, []int]()
	groupUserAllowlist.AddAll(defaultGroupUserAllowlist)
	userVisibleGroups := types.NewRWMap[int, []string]()
	userVisibleGroups.AddAll(defaultUserVisibleGroups)

	groupRatioMap.AddAll(defaultGroupRatio)
	groupGroupRatioMap.AddAll(defaultGroupGroupRatio)

	groupRatioSetting = GroupRatioSetting{
		GroupSpecialUsableGroup: groupSpecialUsableGroup,
		GroupUserAllowlist:      groupUserAllowlist,
		UserVisibleGroups:       userVisibleGroups,
		GroupRatio:              groupRatioMap,
		GroupGroupRatio:         groupGroupRatioMap,
	}

	config.GlobalConfig.Register("group_ratio_setting", &groupRatioSetting)
}

func GetGroupRatioSetting() *GroupRatioSetting {
	if groupRatioSetting.GroupSpecialUsableGroup == nil {
		groupRatioSetting.GroupSpecialUsableGroup = types.NewRWMap[string, map[string]string]()
		groupRatioSetting.GroupSpecialUsableGroup.AddAll(defaultGroupSpecialUsableGroup)
	}
	if groupRatioSetting.GroupUserAllowlist == nil {
		groupRatioSetting.GroupUserAllowlist = types.NewRWMap[string, []int]()
		groupRatioSetting.GroupUserAllowlist.AddAll(defaultGroupUserAllowlist)
	}
	if groupRatioSetting.UserVisibleGroups == nil {
		groupRatioSetting.UserVisibleGroups = types.NewRWMap[int, []string]()
		groupRatioSetting.UserVisibleGroups.AddAll(defaultUserVisibleGroups)
	}
	return &groupRatioSetting
}

func ValidateGroupUserAllowlistJSON(jsonStr string) error {
	allowlist := make(map[string][]int)
	if err := common.Unmarshal([]byte(jsonStr), &allowlist); err != nil {
		return err
	}
	for group, userIDs := range allowlist {
		if group == "" {
			return errors.New("group user allowlist contains an empty group")
		}
		seen := make(map[int]struct{}, len(userIDs))
		for _, userID := range userIDs {
			if userID <= 0 {
				return errors.New("group user allowlist contains an invalid user ID")
			}
			if _, ok := seen[userID]; ok {
				return errors.New("group user allowlist contains a duplicate user ID")
			}
			seen[userID] = struct{}{}
		}
	}
	return nil
}

func ValidateUserVisibleGroupsJSON(jsonStr string) error {
	visibleGroups := make(map[int][]string)
	if err := common.Unmarshal([]byte(jsonStr), &visibleGroups); err != nil {
		return err
	}
	for userID, groups := range visibleGroups {
		if userID <= 0 {
			return errors.New("user visible groups contains an invalid user ID")
		}
		seen := make(map[string]struct{}, len(groups))
		for _, group := range groups {
			if group == "" || group == "auto" {
				return errors.New("user visible groups contains an empty or auto group")
			}
			if _, ok := seen[group]; ok {
				return errors.New("user visible groups contains a duplicate group")
			}
			seen[group] = struct{}{}
		}
	}
	return nil
}

func GetGroupRatioCopy() map[string]float64 {
	return groupRatioMap.ReadAll()
}

func ContainsGroupRatio(name string) bool {
	_, ok := groupRatioMap.Get(name)
	return ok
}

func GroupRatio2JSONString() string {
	return groupRatioMap.MarshalJSONString()
}

func UpdateGroupRatioByJSONString(jsonStr string) error {
	return types.LoadFromJsonString(groupRatioMap, jsonStr)
}

func GetGroupRatio(name string) float64 {
	ratio, ok := groupRatioMap.Get(name)
	if !ok {
		common.SysLog("group ratio not found: " + name)
		return 1
	}
	return ratio
}

func GetGroupGroupRatio(userGroup, usingGroup string) (float64, bool) {
	gp, ok := groupGroupRatioMap.Get(userGroup)
	if !ok {
		return -1, false
	}
	ratio, ok := gp[usingGroup]
	if !ok {
		return -1, false
	}
	return ratio, true
}

func GroupGroupRatio2JSONString() string {
	return groupGroupRatioMap.MarshalJSONString()
}

func UpdateGroupGroupRatioByJSONString(jsonStr string) error {
	return types.LoadFromJsonString(groupGroupRatioMap, jsonStr)
}

func CheckGroupRatio(jsonStr string) error {
	checkGroupRatio := make(map[string]float64)
	err := json.Unmarshal([]byte(jsonStr), &checkGroupRatio)
	if err != nil {
		return err
	}
	for name, ratio := range checkGroupRatio {
		if ratio < 0 {
			return errors.New("group ratio must be not less than 0: " + name)
		}
	}
	return nil
}

func NormalizeGroupName(name string) string {
	return strings.TrimSpace(name)
}

func IsReservedGroupName(name string) bool {
	return name == "" || name == "auto"
}

func DetectGroupRenames(oldGroups, newGroups map[string]float64) map[string]string {
	var deleted, added []string
	for name := range oldGroups {
		if _, ok := newGroups[name]; !ok {
			deleted = append(deleted, name)
		}
	}
	for name := range newGroups {
		if _, ok := oldGroups[name]; !ok {
			added = append(added, name)
		}
	}
	if len(deleted) != 1 || len(added) != 1 {
		return nil
	}
	return map[string]string{deleted[0]: added[0]}
}

func ValidateGroupRenames(oldGroups, newGroups map[string]float64, renames map[string]string) (map[string]string, error) {
	normalized := make(map[string]string, len(renames))
	seenNew := make(map[string]string, len(renames))
	for oldName, newName := range renames {
		oldName = NormalizeGroupName(oldName)
		newName = NormalizeGroupName(newName)
		if oldName == newName {
			continue
		}
		if IsReservedGroupName(oldName) || IsReservedGroupName(newName) {
			return nil, fmt.Errorf("cannot rename reserved group %q to %q", oldName, newName)
		}
		if strings.Contains(oldName, ",") || strings.Contains(newName, ",") {
			return nil, fmt.Errorf("group name must not contain commas: %q -> %q", oldName, newName)
		}
		if _, ok := oldGroups[oldName]; !ok {
			return nil, fmt.Errorf("cannot rename unknown group %q", oldName)
		}
		if _, stillExists := newGroups[oldName]; stillExists {
			continue
		}
		if _, ok := newGroups[newName]; !ok {
			return nil, fmt.Errorf("renamed group %q is missing from the new group list", newName)
		}
		if other, ok := seenNew[newName]; ok {
			return nil, fmt.Errorf("groups %q and %q cannot both rename to %q", other, oldName, newName)
		}
		seenNew[newName] = oldName
		normalized[oldName] = newName
	}
	for oldName, newName := range normalized {
		if _, exists := oldGroups[newName]; !exists {
			continue
		}
		if _, moving := normalized[newName]; !moving {
			return nil, fmt.Errorf("cannot rename %q to existing group %q", oldName, newName)
		}
	}
	if len(normalized) == 0 {
		return nil, nil
	}
	return normalized, nil
}

func RemapGroupKeys[V any](values map[string]V, renames map[string]string) {
	if len(values) == 0 || len(renames) == 0 {
		return
	}
	pending := make(map[string]V, len(renames))
	for oldName, newName := range renames {
		value, ok := values[oldName]
		if !ok {
			continue
		}
		delete(values, oldName)
		pending[newName] = value
	}
	for newName, value := range pending {
		if _, exists := values[newName]; !exists {
			values[newName] = value
		}
	}
}

func RemapNestedGroupRatio(values map[string]map[string]float64, renames map[string]string) {
	RemapGroupKeys(values, renames)
	for _, inner := range values {
		RemapGroupKeys(inner, renames)
	}
}

func RemapSpecialUsableGroups(values map[string]map[string]string, renames map[string]string) {
	RemapGroupKeys(values, renames)
	for _, inner := range values {
		pending := make(map[string]string)
		for key, desc := range inner {
			nextKey := remapSpecialUsableKey(key, renames)
			if nextKey == key {
				continue
			}
			delete(inner, key)
			pending[nextKey] = desc
		}
		for key, desc := range pending {
			if _, exists := inner[key]; !exists {
				inner[key] = desc
			}
		}
	}
}

func remapSpecialUsableKey(key string, renames map[string]string) string {
	prefix := ""
	name := key
	if strings.HasPrefix(key, "-:") {
		prefix = "-:"
		name = strings.TrimPrefix(key, "-:")
	} else if strings.HasPrefix(key, "+:") {
		prefix = "+:"
		name = strings.TrimPrefix(key, "+:")
	}
	if next, ok := renames[name]; ok {
		return prefix + next
	}
	return key
}

func RemapStringList(values []string, renames map[string]string) []string {
	if len(values) == 0 || len(renames) == 0 {
		return values
	}
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		if next, ok := renames[value]; ok {
			value = next
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func RemapCommaSeparatedGroups(value string, renames map[string]string) (string, bool) {
	if value == "" || len(renames) == 0 {
		return value, false
	}
	parts := strings.Split(value, ",")
	changed := false
	seen := make(map[string]struct{}, len(parts))
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		name := strings.TrimSpace(part)
		if next, ok := renames[name]; ok {
			name = next
			changed = true
		}
		if name == "" {
			continue
		}
		if _, dup := seen[name]; dup {
			changed = true
			continue
		}
		seen[name] = struct{}{}
		out = append(out, name)
	}
	return strings.Join(out, ","), changed
}

func RemapGroupRatioSettingJSON(jsonStr string, renames map[string]string) (string, error) {
	values := make(map[string]map[string]float64)
	if strings.TrimSpace(jsonStr) != "" {
		if err := common.UnmarshalJsonStr(jsonStr, &values); err != nil {
			return "", err
		}
	}
	RemapNestedGroupRatio(values, renames)
	data, err := common.Marshal(values)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func RemapSpecialUsableGroupJSON(jsonStr string, renames map[string]string) (string, error) {
	values := make(map[string]map[string]string)
	if strings.TrimSpace(jsonStr) != "" {
		if err := common.UnmarshalJsonStr(jsonStr, &values); err != nil {
			return "", err
		}
	}
	RemapSpecialUsableGroups(values, renames)
	data, err := common.Marshal(values)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func RemapGroupUserAllowlistJSON(jsonStr string, renames map[string]string) (string, error) {
	values := make(map[string][]int)
	if strings.TrimSpace(jsonStr) != "" {
		if err := common.UnmarshalJsonStr(jsonStr, &values); err != nil {
			return "", err
		}
	}
	RemapGroupKeys(values, renames)
	data, err := common.Marshal(values)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func RemapUserVisibleGroupsJSON(jsonStr string, renames map[string]string) (string, error) {
	values := make(map[int][]string)
	if strings.TrimSpace(jsonStr) != "" {
		if err := common.UnmarshalJsonStr(jsonStr, &values); err != nil {
			return "", err
		}
	}
	for userID, groups := range values {
		seen := make(map[string]struct{}, len(groups))
		remapped := make([]string, 0, len(groups))
		for _, group := range groups {
			if next, ok := renames[group]; ok {
				group = next
			}
			if _, dup := seen[group]; dup {
				continue
			}
			seen[group] = struct{}{}
			remapped = append(remapped, group)
		}
		values[userID] = remapped
	}
	data, err := common.Marshal(values)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
