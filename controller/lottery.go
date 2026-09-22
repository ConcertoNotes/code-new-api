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
	base["draw_count"] = info.DrawsAvailable
	base["draws_used"] = info.DrawsUsed
	base["total_recharge"] = info.Recharge
	base["total_reward"] = info.TotalReward
	base["next_threshold"] = info.NextThreshold
	base["refilling"] = info.Refilling
	// 奖池明细只给管理员，普通用户保持神秘感
	if isAdmin {
		remaining := map[string]int{}
		initial := map[string]int{}
		for _, p := range info.Prizes {
			remaining[formatLotteryAmount(p.Amount)] = p.Stock
			initial[formatLotteryAmount(p.Amount)] = p.InitialStock
		}
		base["pool_remaining"] = remaining
		base["pool_initial"] = initial
		base["budget_remaining"] = info.BudgetRemaining
		// 管理员没有真实次数或预算不足时，仍可做不入账的预览抽奖
		base["preview_available"] = info.DrawsAvailable <= 0 || info.Refilling
	}
	c.JSON(http.StatusOK, base)
}

func DrawLottery(c *gin.Context) {
	userId := c.GetInt("id")
	isAdmin := c.GetInt("role") >= common.RoleAdminUser
	// 管理员：有真实次数且预算够就走真实抽奖；否则做一次不入账的预览，方便随时查看效果
	if isAdmin {
		info, statusErr := model.GetLotteryStatus(userId)
		if statusErr == nil && (info.DrawsAvailable <= 0 || info.Refilling) {
			result, err := model.PreviewLottery(userId)
			if err != nil {
				c.JSON(http.StatusConflict, gin.H{"message": err.Error(), "code": "pool_exhausted"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"reward": result.Amount, "quota": result.Quota, "record_id": 0, "preview": true, "message": "preview"})
			return
		}
	}
	result, err := model.DrawLottery(userId, isAdmin)
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
	c.JSON(http.StatusOK, gin.H{"reward": result.Amount, "quota": result.Quota, "record_id": result.Id, "preview": false, "message": "success"})
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

// GetLotteryAdminOverview 管理员监控：剩余奖券、预算、已发放和中奖榜
func GetLotteryAdminOverview(c *gin.Context) {
	overview, err := model.GetLotteryAdminOverview(100)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, overview)
}

// GetLotteryAdminDraws 管理员监控：全站抽奖记录分页列表
func GetLotteryAdminDraws(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetLotteryDrawsForAdmin(c.Query("keyword"), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}
