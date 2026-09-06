package service

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestShouldSuppressEstimatedClientGoneCharge(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyLocalCountTokens, true)

	start := time.Now()
	info := &relaycommon.RelayInfo{
		IsStream:          true,
		StartTime:         start,
		FirstResponseTime: start.Add(-time.Second),
		StreamStatus:      relaycommon.NewStreamStatus(),
	}
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, contextCanceledError{})

	require.True(t, shouldSuppressEstimatedClientGoneCharge(ctx, info))

	info.FirstResponseTime = start.Add(time.Second)
	assert.False(t, shouldSuppressEstimatedClientGoneCharge(ctx, info), "a request that sent a response may have upstream usage")

	info.FirstResponseTime = start.Add(-time.Second)
	common.SetContextKey(ctx, constant.ContextKeyLocalCountTokens, false)
	assert.False(t, shouldSuppressEstimatedClientGoneCharge(ctx, info), "without a local estimate there is no fallback charge to suppress")

	info.StreamStatus = relaycommon.NewStreamStatus()
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonDone, nil)
	common.SetContextKey(ctx, constant.ContextKeyLocalCountTokens, true)
	assert.False(t, shouldSuppressEstimatedClientGoneCharge(ctx, info))
}

// contextCanceledError avoids importing context solely for the test error value.
type contextCanceledError struct{}

func (contextCanceledError) Error() string { return "context canceled" }
