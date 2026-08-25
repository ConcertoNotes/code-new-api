package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPasswordLoginDoesNotUseCriticalRateLimit(t *testing.T) {
	previousCriticalRateLimitEnable := common.CriticalRateLimitEnable
	previousCriticalRateLimitNum := common.CriticalRateLimitNum
	previousCriticalRateLimitDuration := common.CriticalRateLimitDuration
	previousGlobalAPIRateLimitEnable := common.GlobalApiRateLimitEnable
	previousRedisEnabled := common.RedisEnabled
	previousPasswordLoginEnabled := common.PasswordLoginEnabled
	previousTurnstileCheckEnabled := common.TurnstileCheckEnabled
	t.Cleanup(func() {
		common.CriticalRateLimitEnable = previousCriticalRateLimitEnable
		common.CriticalRateLimitNum = previousCriticalRateLimitNum
		common.CriticalRateLimitDuration = previousCriticalRateLimitDuration
		common.GlobalApiRateLimitEnable = previousGlobalAPIRateLimitEnable
		common.RedisEnabled = previousRedisEnabled
		common.PasswordLoginEnabled = previousPasswordLoginEnabled
		common.TurnstileCheckEnabled = previousTurnstileCheckEnabled
	})

	common.CriticalRateLimitEnable = true
	common.CriticalRateLimitNum = 1
	common.CriticalRateLimitDuration = 60
	common.GlobalApiRateLimitEnable = false
	common.RedisEnabled = false
	common.PasswordLoginEnabled = true
	common.TurnstileCheckEnabled = false

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	require.NoError(t, engine.SetTrustedProxies(nil))
	SetApiRouter(engine)

	requestLogin := func() *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(
			http.MethodPost,
			"/api/user/login",
			strings.NewReader(`{"username":"","password":""}`),
		)
		request.Header.Set("Content-Type", "application/json")
		request.RemoteAddr = "192.0.2.77:12345"
		engine.ServeHTTP(recorder, request)
		return recorder
	}

	firstResponse := requestLogin()
	secondResponse := requestLogin()

	assert.Equal(t, http.StatusOK, firstResponse.Code)
	assert.Equal(t, http.StatusOK, secondResponse.Code)
	assert.NotEqual(t, http.StatusTooManyRequests, secondResponse.Code)
}
