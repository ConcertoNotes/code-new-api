package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestBlacklistIPBlocksAPIAndWebRequests(t *testing.T) {
	gin.SetMode(gin.TestMode)
	common.SetBlacklistIPs([]string{"192.0.2.1"})
	t.Cleanup(func() { common.SetBlacklistIPs(nil) })

	for _, testCase := range []struct {
		name string
		path string
		want string
	}{
		{name: "api", path: "/api/status", want: "你已被拉黑"},
		{name: "web", path: "/", want: "你已被拉黑"},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			router := gin.New()
			called := false
			router.Use(BlacklistIP())
			router.Any("/*path", func(c *gin.Context) {
				called = true
				c.Status(http.StatusOK)
			})
			request := httptest.NewRequest(http.MethodGet, testCase.path, nil)
			request.RemoteAddr = "192.0.2.1:12345"
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			require.Equal(t, http.StatusForbidden, response.Code)
			require.Contains(t, response.Body.String(), testCase.want)
			require.False(t, called)
		})
	}
}

func TestBlacklistIPAllowsUnlistedIP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	common.SetBlacklistIPs([]string{"192.0.2.1"})
	t.Cleanup(func() { common.SetBlacklistIPs(nil) })

	router := gin.New()
	router.Use(BlacklistIP())
	router.GET("/", func(c *gin.Context) { c.Status(http.StatusNoContent) })
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.RemoteAddr = "192.0.2.2:12345"
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	require.Equal(t, http.StatusNoContent, response.Code)
}
