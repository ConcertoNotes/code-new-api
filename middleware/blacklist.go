package middleware

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// BlacklistIP rejects every request originating from a configured IP.
func BlacklistIP() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !common.IsBlacklistedIP(c.ClientIP()) {
			c.Next()
			return
		}

		if strings.HasPrefix(c.Request.URL.Path, "/api/") || c.Request.URL.Path == "/api" {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": "你已被拉黑",
			})
		} else {
			c.String(http.StatusForbidden, "你已被拉黑")
		}
		c.Abort()
	}
}
