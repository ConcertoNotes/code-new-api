package model

import (
	"errors"
	"math/rand"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type LotteryPrize struct {
	Id           int     `json:"id"`
	Amount       float64 `json:"amount"`
	Stock        int     `json:"stock"`
	InitialStock int     `json:"initial_stock"`
}

type LotteryDraw struct {
	Id        int     `json:"id"`
	UserId    int     `json:"user_id" gorm:"index"`
	Amount    float64 `json:"amount"`
	CreatedAt int64   `json:"created_at" gorm:"index"`
}

var lotteryPrizes = []struct {
	amount float64
	stock  int
}{{.5, 100}, {1, 30}, {5, 10}, {10, 5}}

func ensureLotteryPrizes(tx *gorm.DB) error {
	var n int64
	if err := tx.Model(&LotteryPrize{}).Count(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	for _, p := range lotteryPrizes {
		if err := tx.Create(&LotteryPrize{Amount: p.amount, Stock: p.stock, InitialStock: p.stock}).Error; err != nil {
			return err
		}
	}
	return nil
}

func LotteryPrizeSnapshot() ([]LotteryPrize, error) {
	if err := ensureLotteryPrizes(DB); err != nil {
		return nil, err
	}
	var prizes []LotteryPrize
	return prizes, DB.Order("amount").Find(&prizes).Error
}

func LotteryDrawCount(userId int) (int64, error) {
	var n int64
	err := DB.Model(&LotteryDraw{}).Where("user_id = ?", userId).Count(&n).Error
	return n, err
}

func LotteryTotalRecharge(userId int, since int64) (float64, error) {
	var total float64
	err := DB.Model(&TopUp{}).Where("user_id = ? AND status = ? AND complete_time >= ?", userId, common.TopUpStatusSuccess, since).Select("COALESCE(SUM(money), 0)").Scan(&total).Error
	return total, err
}

func DrawLottery(userId int) (LotteryDraw, error) {
	var result LotteryDraw
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := ensureLotteryPrizes(tx); err != nil {
			return err
		}
		since := time.Now().AddDate(0, 0, -30).Unix()
		var recharge float64
		if err := tx.Model(&TopUp{}).Where("user_id = ? AND status = ? AND complete_time >= ?", userId, common.TopUpStatusSuccess, since).Select("COALESCE(SUM(money), 0)").Scan(&recharge).Error; err != nil {
			return err
		}
		var used int64
		if err := tx.Model(&LotteryDraw{}).Where("user_id = ?", userId).Count(&used).Error; err != nil {
			return err
		}
		if int64(recharge/20) <= used {
			return errors.New("lottery draw unavailable")
		}
		var prizes []LotteryPrize
		if err := lockForUpdate(tx).Order("amount").Find(&prizes).Error; err != nil {
			return err
		}
		total := 0
		for _, p := range prizes {
			if p.Stock > 0 {
				total += p.Stock
			}
		}
		if total == 0 {
			return errors.New("lottery pool exhausted")
		}
		pick := rand.Intn(total)
		chosen := -1
		for i, p := range prizes {
			if p.Stock <= 0 {
				continue
			}
			pick -= p.Stock
			if pick < 0 {
				chosen = i
				break
			}
		}
		if chosen < 0 {
			return errors.New("lottery pool exhausted")
		}
		p := &prizes[chosen]
		if err := tx.Model(&LotteryPrize{}).Where("id = ? AND stock > 0", p.Id).UpdateColumn("stock", gorm.Expr("stock - 1")).Error; err != nil {
			return err
		}
		quota := int(p.Amount * common.QuotaPerUnit)
		if err := tx.Model(&User{}).Where("id = ?", userId).UpdateColumn("quota", gorm.Expr("quota + ?", quota)).Error; err != nil {
			return err
		}
		result = LotteryDraw{UserId: userId, Amount: p.Amount, CreatedAt: common.GetTimestamp()}
		return tx.Create(&result).Error
	})
	return result, err
}
