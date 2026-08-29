package model

import (
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

var blacklistPersistMu sync.Mutex

// AddBlacklistIP appends a normalized IP to the persisted blacklist.
func AddBlacklistIP(ip string) error {
	normalized, ok := common.NormalizeBlacklistIP(ip)
	if !ok {
		return gorm.ErrInvalidData
	}

	blacklistPersistMu.Lock()
	defer blacklistPersistMu.Unlock()
	if DB == nil {
		return gorm.ErrInvalidData
	}

	var option Option
	err := DB.Where("key = ?", "BlacklistIPs").First(&option).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}
	current, err := common.ParseBlacklistIPs(option.Value)
	if err != nil {
		return err
	}
	for _, existing := range current {
		if existing == normalized {
			common.SetBlacklistIPs(current)
			return nil
		}
	}
	current = append(current, normalized)
	value := strings.Join(current, "\n")
	option = Option{Key: "BlacklistIPs"}
	if err := DB.FirstOrCreate(&option, Option{Key: "BlacklistIPs"}).Error; err != nil {
		return err
	}
	option.Value = value
	if err := DB.Save(&option).Error; err != nil {
		return err
	}
	return updateOptionMap("BlacklistIPs", value)
}
