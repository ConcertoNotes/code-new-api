package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRelayReturnsBadRequestForInvalidImageRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1/images/generations",
		bytes.NewBufferString(`{"model":"gpt-image-2","prompt":"test","size":"1025x1025"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	Relay(ctx, types.RelayFormatOpenAIImage)

	require.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"code":"invalid_request"`)
	assert.Contains(t, recorder.Body.String(), "multiples of 16")
}
