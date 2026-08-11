package model

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func IsChannelEnabledForGroupModel(group string, modelName string, channelID int) bool {
	if group == "" || modelName == "" || channelID <= 0 {
		return false
	}
	if !common.MemoryCacheEnabled {
		return isChannelEnabledForGroupModelDB(group, modelName, channelID)
	}

	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	if group2model2channels == nil {
		return false
	}

	if isChannelIDInList(group2model2channels[group][modelName], channelID) {
		return true
	}
	normalized := ratio_setting.FormatMatchingModelName(modelName)
	if normalized != "" && normalized != modelName {
		return isChannelIDInList(group2model2channels[group][normalized], channelID)
	}
	return false
}

func IsChannelEnabledForAnyGroupModel(groups []string, modelName string, channelID int) bool {
	if len(groups) == 0 {
		return false
	}
	for _, g := range groups {
		if IsChannelEnabledForGroupModel(g, modelName, channelID) {
			return true
		}
	}
	return false
}

// IsChannelHighestPriorityForGroupModel reports whether channelID is eligible
// in the highest currently available priority tier for this request. This keeps
// affinity within a tier without allowing it to pin traffic to a fallback tier
// after a higher-priority channel becomes available again.
func IsChannelHighestPriorityForGroupModel(group string, modelName string, channelID int, requestPath string) bool {
	if group == "" || modelName == "" || channelID <= 0 {
		return false
	}
	if !common.MemoryCacheEnabled {
		var abilities []Ability
		DB.Where(commonGroupCol+" = ? and model = ? and enabled = ?", group, modelName, true).Find(&abilities)
		abilities = filterAbilitiesByRequestPathAndModel(abilities, requestPath, modelName)
		if len(abilities) == 0 {
			normalized := ratio_setting.FormatMatchingModelName(modelName)
			if normalized != "" && normalized != modelName {
				DB.Where(commonGroupCol+" = ? and model = ? and enabled = ?", group, normalized, true).Find(&abilities)
				abilities = filterAbilitiesByRequestPathAndModel(abilities, requestPath, modelName)
			}
		}
		var highestPriority int64
		var channelPriority int64
		hasHighestPriority := false
		channelFound := false
		for _, ability := range abilities {
			priority := int64(0)
			if ability.Priority != nil {
				priority = *ability.Priority
			}
			if !hasHighestPriority || priority > highestPriority {
				highestPriority = priority
				hasHighestPriority = true
			}
			if ability.ChannelId == channelID {
				channelPriority = priority
				channelFound = true
			}
		}
		return channelFound && hasHighestPriority && channelPriority == highestPriority
	}

	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	if group2model2channels == nil {
		return false
	}
	channels := filterChannelsByRequestPathAndModel(group2model2channels[group][modelName], requestPath, modelName)
	if len(channels) == 0 {
		normalized := ratio_setting.FormatMatchingModelName(modelName)
		if normalized != "" && normalized != modelName {
			channels = filterChannelsByRequestPathAndModel(group2model2channels[group][normalized], requestPath, modelName)
		}
	}
	if len(channels) == 0 || !isChannelIDInList(channels, channelID) {
		return false
	}
	channel, ok := channelsIDM[channelID]
	if !ok {
		return false
	}
	highest, ok := channelsIDM[channels[0]]
	return ok && channel.GetPriority() == highest.GetPriority()
}

func isChannelEnabledForGroupModelDB(group string, modelName string, channelID int) bool {
	var count int64
	err := DB.Model(&Ability{}).
		Where(commonGroupCol+" = ? and model = ? and channel_id = ? and enabled = ?", group, modelName, channelID, true).
		Count(&count).Error
	if err == nil && count > 0 {
		return true
	}
	normalized := ratio_setting.FormatMatchingModelName(modelName)
	if normalized == "" || normalized == modelName {
		return false
	}
	count = 0
	err = DB.Model(&Ability{}).
		Where(commonGroupCol+" = ? and model = ? and channel_id = ? and enabled = ?", group, normalized, channelID, true).
		Count(&count).Error
	return err == nil && count > 0
}

func isChannelIDInList(list []int, channelID int) bool {
	for _, id := range list {
		if id == channelID {
			return true
		}
	}
	return false
}
