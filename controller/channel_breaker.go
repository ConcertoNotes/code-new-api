package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// GetChannelBreakers 返回当前所有处于熔断记录中的渠道状态。
func GetChannelBreakers(c *gin.Context) {
	common.ApiSuccess(c, service.ListChannelBreakerSnapshots())
}

// ResetChannelBreaker 手动解除某个渠道的熔断冷却，使其立即重新参与选路。
func ResetChannelBreaker(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	service.ResetChannelBreaker(id)
	recordManageAudit(c, "channel.breaker_reset", map[string]interface{}{
		"id": id,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}
