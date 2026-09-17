package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

func formatLotteryAmount(amount float64) string { return strconv.FormatFloat(amount, 'f', -1, 64) }

func GetLotteryStatus(c *gin.Context) {
	s := operation_setting.GetLotterySetting()
	now := common.GetTimestamp()
	// 管理员不受活动时间限制，便于上线前预览和验收；普通用户严格按窗口
	isAdmin := c.GetInt("role") >= common.RoleAdminUser
	base := gin.H{
		"enabled":        s.Enabled,
		"before_start":   !isAdmin && now < s.StartTime,
		"ended":          !isAdmin && now >= s.EndTime,
		"admin_preview":  isAdmin && !s.IsActive(now),
		"activity_start": model.LotteryActivityTime(s.StartTime),
		"activity_end":   model.LotteryActivityTime(s.EndTime),
		"threshold":      s.EffectiveThreshold(),
	}
	if !s.Enabled || (!isAdmin && !s.IsActive(now)) {
		base["draw_count"] = 0
		base["total_recharge"] = 0
		base["total_reward"] = 0
		base["pool_remaining"] = map[string]int{}
		base["pool_initial"] = map[string]int{}
		base["next_threshold"] = 0
		base["refilling"] = false
		c.JSON(http.StatusOK, base)
		return
	}
	info, err := model.GetLotteryStatus(c.GetInt("id"))
	if err != nil {
		common.SysError("failed to load lottery status: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to load lottery"})
		return
	}
	remaining := map[string]int{}
	initial := map[string]int{}
	for _, p := range info.Prizes {
		remaining[formatLotteryAmount(p.Amount)] = p.Stock
		initial[formatLotteryAmount(p.Amount)] = p.InitialStock
	}
	base["draw_count"] = info.DrawsAvailable
	base["draws_used"] = info.DrawsUsed
	base["total_recharge"] = info.Recharge
	base["total_reward"] = info.TotalReward
	base["pool_remaining"] = remaining
	base["pool_initial"] = initial
	base["next_threshold"] = info.NextThreshold
	base["refilling"] = info.Refilling
	c.JSON(http.StatusOK, base)
}

func DrawLottery(c *gin.Context) {
	result, err := model.DrawLottery(c.GetInt("id"), c.GetInt("role") >= common.RoleAdminUser)
	if err != nil {
		status := http.StatusBadRequest
		code := "failed"
		switch {
		case errors.Is(err, model.ErrLotteryInactive):
			status, code = http.StatusForbidden, "inactive"
		case errors.Is(err, model.ErrLotteryNoDraws):
			code = "no_draws"
		case errors.Is(err, model.ErrLotteryRefilling):
			status, code = http.StatusConflict, "pool_refilling"
		case errors.Is(err, model.ErrLotteryPoolExhausted):
			status, code = http.StatusConflict, "pool_exhausted"
		case errors.Is(err, model.ErrLotteryRetry):
			status, code = http.StatusConflict, "retry"
		default:
			common.SysError("lottery draw failed: " + err.Error())
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"message": err.Error(), "code": code})
		return
	}
	c.JSON(http.StatusOK, gin.H{"reward": result.Amount, "quota": result.Quota, "record_id": result.Id, "message": "success"})
}

func GetLotteryRecords(c *gin.Context) {
	rows, err := model.GetLotteryRecords(c.GetInt("id"), 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to load records"})
		return
	}
	items := make([]gin.H, 0, len(rows))
	for _, r := range rows {
		items = append(items, gin.H{"id": r.Id, "reward": r.Amount, "quota": r.Quota, "created_at": r.CreatedAt})
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}
