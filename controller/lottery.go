package controller

import (
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetLotteryStatus(c *gin.Context) {
	now := time.Now()
	start := time.Date(2026, 9, 25, 0, 0, 0, 0, now.Location())
	end := time.Date(2026, 10, 8, 0, 0, 0, 0, now.Location())
	if now.Before(start) || !now.Before(end) {
		c.JSON(http.StatusOK, gin.H{"enabled": false, "before_start": now.Before(start), "draw_count": 0, "pool_remaining": map[string]int{}, "next_threshold": 0, "activity_end": end.Format(time.RFC3339)})
		return
	}
	id := c.GetInt("id")
	since := time.Now().AddDate(0, 0, -30).Unix()
	recharge, err := model.LotteryTotalRecharge(id, since)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to load lottery"})
		return
	}
	drawn, err := model.LotteryDrawCount(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to load lottery"})
		return
	}
	prizes, err := model.LotteryPrizeSnapshot()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to load lottery"})
		return
	}
	pool := map[string]int{}
	for _, p := range prizes {
		pool[formatLotteryAmount(p.Amount)] = p.Stock
	}
	available := int(recharge/20) - int(drawn)
	if available < 0 {
		available = 0
	}
	next := 20 - int(recharge)%20
	if next == 20 {
		next = 0
	}
	c.JSON(http.StatusOK, gin.H{"enabled": true, "draw_count": available, "total_recharge": recharge, "total_reward": 0, "pool_remaining": pool, "next_threshold": next, "activity_end": "2026-10-07T23:59:59+08:00"})
}

func formatLotteryAmount(amount float64) string { return strconv.FormatFloat(amount, 'f', -1, 64) }

func DrawLottery(c *gin.Context) {
	result, err := model.DrawLottery(c.GetInt("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"reward": result.Amount, "draw_count": 0, "message": "success"})
}

func GetLotteryRecords(c *gin.Context) {
	var rows []model.LotteryDraw
	err := model.DB.Where("user_id = ?", c.GetInt("id")).Order("created_at DESC").Limit(100).Find(&rows).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to load records"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": rows})
}
