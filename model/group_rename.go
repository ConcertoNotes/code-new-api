package model

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"gorm.io/gorm"
)

type groupRenameCascadeResult struct {
	userIDs  []int
	tokenIDs []int
}

func SaveGroupRatioWithRenames(groupRatioJSON string, renames map[string]string) error {
	validGroups := make(map[string]float64)
	if err := common.UnmarshalJsonStr(groupRatioJSON, &validGroups); err != nil {
		return err
	}
	optionValues := map[string]string{
		"GroupRatio": groupRatioJSON,
	}
	if len(renames) > 0 {
		related, err := remappedGroupOptionValues(renames)
		if err != nil {
			return err
		}
		for key, value := range related {
			optionValues[key] = value
		}
	}
	billingJSON := "{}"
	if data, err := common.Marshal(billing_setting.GetGroupBillingExprCopy()); err == nil {
		billingJSON = string(data)
	}
	if remapped, ok := optionValues["billing_setting.group_billing_expr"]; ok {
		billingJSON = remapped
	}
	prunedExpr, pruneChanged, err := billing_setting.PruneGroupBillingExprJSON(billingJSON, validGroups)
	if err != nil {
		return err
	}
	if pruneChanged {
		optionValues["billing_setting.group_billing_expr"] = prunedExpr
	}
	for key, value := range optionValues {
		if err := validateOptionValue(key, value); err != nil {
			return err
		}
	}

	var cascade groupRenameCascadeResult
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := persistOptionsTx(tx, optionValues); err != nil {
			return err
		}
		if len(renames) == 0 {
			return nil
		}
		var cascadeErr error
		cascade, cascadeErr = applyGroupRenameCascade(tx, renames)
		return cascadeErr
	})
	if err != nil {
		return err
	}
	for key, value := range optionValues {
		if err := updateOptionMap(key, value); err != nil {
			return err
		}
	}
	if len(renames) == 0 {
		return nil
	}
	InitChannelCache()
	refreshGroupRenameCaches(cascade)
	return nil
}

func persistOptionsTx(tx *gorm.DB, values map[string]string) error {
	for key, value := range values {
		option := Option{Key: key}
		if err := tx.FirstOrCreate(&option, Option{Key: key}).Error; err != nil {
			return err
		}
		option.Value = value
		if err := tx.Save(&option).Error; err != nil {
			return err
		}
	}
	return nil
}

func remappedGroupOptionValues(renames map[string]string) (map[string]string, error) {
	type remapSpec struct {
		key    string
		remap  func(string, map[string]string) (string, error)
		source func() string
	}
	specs := []remapSpec{
		{"UserUsableGroups", setting.RemapUserUsableGroupsJSON, setting.UserUsableGroups2JSONString},
		{"GroupGroupRatio", ratio_setting.RemapGroupRatioSettingJSON, ratio_setting.GroupGroupRatio2JSONString},
		{"TopupGroupRatio", common.RemapTopupGroupRatioJSON, common.TopupGroupRatio2JSONString},
		{"AutoGroups", setting.RemapAutoGroupsJSON, setting.AutoGroups2JsonString},
		{"group_ratio_setting.group_special_usable_group", ratio_setting.RemapSpecialUsableGroupJSON, func() string {
			data, err := common.Marshal(ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.ReadAll())
			if err != nil {
				return "{}"
			}
			return string(data)
		}},
		{"group_ratio_setting.group_user_allowlist", ratio_setting.RemapGroupUserAllowlistJSON, func() string {
			data, err := common.Marshal(ratio_setting.GetGroupRatioSetting().GroupUserAllowlist.ReadAll())
			if err != nil {
				return "{}"
			}
			return string(data)
		}},
		{"billing_setting.group_billing_expr", billing_setting.RemapGroupBillingExprJSON, func() string {
			data, err := common.Marshal(billing_setting.GetGroupBillingExprCopy())
			if err != nil {
				return "{}"
			}
			return string(data)
		}},
		{"ModelRequestRateLimitGroup", setting.RemapModelRequestRateLimitGroupJSON, setting.ModelRequestRateLimitGroup2JSONString},
	}
	result := make(map[string]string)
	for _, spec := range specs {
		current := spec.source()
		next, err := spec.remap(current, renames)
		if err != nil {
			return nil, err
		}
		if next != current {
			result[spec.key] = next
		}
	}
	return result, nil
}

func currentOptionValue(key, fallback string) string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if common.OptionMap == nil {
		return fallback
	}
	if value, ok := common.OptionMap[key]; ok {
		return value
	}
	return fallback
}

func applyGroupRenameCascade(tx *gorm.DB, renames map[string]string) (groupRenameCascadeResult, error) {
	var result groupRenameCascadeResult
	if err := renameChannelGroups(tx, renames); err != nil {
		return result, err
	}
	if err := applyExactGroupRenames(tx, "users", commonGroupCol, renames); err != nil {
		return result, err
	}
	if err := applyExactGroupRenames(tx, "tokens", commonGroupCol, renames); err != nil {
		return result, err
	}
	if err := applyExactGroupRenames(tx, "tasks", commonGroupCol, renames); err != nil {
		return result, err
	}
	if err := applyExactGroupRenames(tx, "subscription_plans", "upgrade_group", renames); err != nil {
		return result, err
	}
	if err := applyExactGroupRenames(tx, "subscription_plans", "downgrade_group", renames); err != nil {
		return result, err
	}
	if err := applyExactGroupRenames(tx, "user_subscriptions", "upgrade_group", renames); err != nil {
		return result, err
	}
	if err := applyExactGroupRenames(tx, "user_subscriptions", "downgrade_group", renames); err != nil {
		return result, err
	}
	if err := applyExactGroupRenames(tx, "user_subscriptions", "prev_user_group", renames); err != nil {
		return result, err
	}
	userIDs, err := userIDsInGroups(tx, renameValues(renames))
	if err != nil {
		return result, err
	}
	result.userIDs = userIDs
	tokenIDs, err := remapTokenGroupLists(tx, renames)
	if err != nil {
		return result, err
	}
	result.tokenIDs = tokenIDs
	return result, nil
}

func renameChannelGroups(tx *gorm.DB, renames map[string]string) error {
	channels, err := channelsUsingGroups(tx, renameKeys(renames))
	if err != nil {
		return err
	}
	for i := range channels {
		channel := &channels[i]
		next, changed := ratio_setting.RemapCommaSeparatedGroups(channel.Group, renames)
		if !changed {
			continue
		}
		if err := tx.Model(&Channel{}).Where("id = ?", channel.Id).Update("group", next).Error; err != nil {
			return err
		}
		channel.Group = next
		if err := tx.Where("channel_id = ?", channel.Id).Delete(&Ability{}).Error; err != nil {
			return err
		}
		if err := channel.AddAbilities(tx); err != nil {
			return err
		}
	}
	return nil
}

func channelsUsingGroups(tx *gorm.DB, names []string) ([]Channel, error) {
	if len(names) == 0 {
		return nil, nil
	}
	query := tx.Model(&Channel{})
	for i, name := range names {
		condition := channelGroupFilterCondition()
		pattern := channelGroupFilterPattern(name)
		if i == 0 {
			query = query.Where(condition, pattern)
			continue
		}
		query = query.Or(condition, pattern)
	}
	var channels []Channel
	if err := query.Find(&channels).Error; err != nil {
		return nil, err
	}
	return channels, nil
}

func applyExactGroupRenames(tx *gorm.DB, table, column string, renames map[string]string) error {
	if len(renames) == 0 {
		return nil
	}
	temps := make(map[string]string, len(renames))
	i := 0
	for oldName, newName := range renames {
		temp := fmt.Sprintf("__newapi_rename_%d__", i)
		i++
		if err := tx.Exec(
			"UPDATE "+table+" SET "+column+" = ? WHERE "+column+" = ?",
			temp,
			oldName,
		).Error; err != nil {
			return err
		}
		temps[temp] = newName
	}
	for temp, newName := range temps {
		if err := tx.Exec(
			"UPDATE "+table+" SET "+column+" = ? WHERE "+column+" = ?",
			newName,
			temp,
		).Error; err != nil {
			return err
		}
	}
	return nil
}

func userIDsInGroups(tx *gorm.DB, groups []string) ([]int, error) {
	if len(groups) == 0 {
		return nil, nil
	}
	var ids []int
	if err := tx.Model(&User{}).Where(commonGroupCol+" IN ?", groups).Pluck("id", &ids).Error; err != nil {
		return nil, err
	}
	return ids, nil
}

func remapTokenGroupLists(tx *gorm.DB, renames map[string]string) ([]int, error) {
	oldNames := renameKeys(renames)
	query := tx.Unscoped().Model(&Token{})
	query = query.Where(commonGroupCol+" IN ?", append(oldNames, renameValues(renames)...))
	for _, oldName := range oldNames {
		like := "%\"" + oldName + "\"%"
		query = query.Or("fallback_groups LIKE ?", like).Or("auto_groups LIKE ?", like)
	}
	var tokens []Token
	if err := query.Find(&tokens).Error; err != nil {
		return nil, err
	}
	ids := make([]int, 0, len(tokens))
	seen := make(map[int]struct{}, len(tokens))
	for i := range tokens {
		token := &tokens[i]
		changed := false
		if next, ok := remappedJSONStringList(string(token.FallbackGroups), renames); ok {
			token.FallbackGroups = TokenFallbackGroups(next)
			changed = true
		}
		if next, ok := remappedJSONStringList(token.AutoGroups, renames); ok {
			token.AutoGroups = next
			changed = true
		}
		if changed {
			if err := tx.Model(&Token{}).Where("id = ?", token.Id).
				Select("fallback_groups", "auto_groups").
				Updates(token).Error; err != nil {
				return nil, err
			}
		}
		if _, exists := seen[token.Id]; exists {
			continue
		}
		seen[token.Id] = struct{}{}
		ids = append(ids, token.Id)
	}
	return ids, nil
}

func remappedJSONStringList(raw string, renames map[string]string) (string, bool) {
	if strings.TrimSpace(raw) == "" {
		return raw, false
	}
	var values []string
	if err := common.UnmarshalJsonStr(raw, &values); err != nil {
		return raw, false
	}
	next := ratio_setting.RemapStringList(values, renames)
	if len(next) == len(values) {
		same := true
		for i := range next {
			if next[i] != values[i] {
				same = false
				break
			}
		}
		if same {
			return raw, false
		}
	}
	data, err := common.Marshal(next)
	if err != nil {
		return raw, false
	}
	return string(data), true
}

func refreshGroupRenameCaches(result groupRenameCascadeResult) {
	for _, userID := range result.userIDs {
		if err := RefreshUserGroupCache(userID); err != nil {
			common.SysLog("failed to refresh user group cache after rename: " + err.Error())
		}
	}
	if len(result.tokenIDs) == 0 {
		return
	}
	var tokens []Token
	if err := DB.Unscoped().Select("id", commonKeyCol).Where("id IN ?", result.tokenIDs).Find(&tokens).Error; err != nil {
		common.SysLog("failed to load tokens after group rename: " + err.Error())
		return
	}
	if err := invalidateTokensCache(tokens); err != nil {
		common.SysLog("failed to invalidate token cache after group rename: " + err.Error())
	}
}

func renameKeys(renames map[string]string) []string {
	keys := make([]string, 0, len(renames))
	for oldName := range renames {
		keys = append(keys, oldName)
	}
	return keys
}

func renameValues(renames map[string]string) []string {
	seen := make(map[string]struct{}, len(renames))
	values := make([]string, 0, len(renames))
	for _, newName := range renames {
		if _, ok := seen[newName]; ok {
			continue
		}
		seen[newName] = struct{}{}
		values = append(values, newName)
	}
	return values
}

func ParseGroupRenames(raw any) (map[string]string, error) {
	if raw == nil {
		return nil, nil
	}
	switch value := raw.(type) {
	case map[string]string:
		return value, nil
	case map[string]any:
		renames := make(map[string]string, len(value))
		for oldName, newName := range value {
			text, ok := newName.(string)
			if !ok {
				return nil, fmt.Errorf("group rename target for %q must be a string", oldName)
			}
			renames[oldName] = text
		}
		return renames, nil
	case string:
		if strings.TrimSpace(value) == "" {
			return nil, nil
		}
		renames := make(map[string]string)
		if err := common.UnmarshalJsonStr(value, &renames); err != nil {
			return nil, err
		}
		return renames, nil
	default:
		return nil, fmt.Errorf("invalid group rename payload")
	}
}
