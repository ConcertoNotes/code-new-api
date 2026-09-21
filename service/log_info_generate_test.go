package service

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAppendClientInfo(t *testing.T) {
	t.Run("records the raw User-Agent header as a public field", func(t *testing.T) {
		relayInfo := &relaycommon.RelayInfo{
			RequestHeaders: map[string]string{"User-Agent": "claude-cli/1.2.3 (external, cli)"},
		}
		other := model.NewLogOther()

		AppendClientInfo(relayInfo, other)

		assert.Equal(t, "claude-cli/1.2.3 (external, cli)", other.Snapshot()["client_user_agent"])
	})

	t.Run("does nothing when the User-Agent header is absent", func(t *testing.T) {
		relayInfo := &relaycommon.RelayInfo{RequestHeaders: map[string]string{}}
		other := model.NewLogOther()

		AppendClientInfo(relayInfo, other)

		_, exists := other.Snapshot()["client_user_agent"]
		assert.False(t, exists)
	})

	t.Run("does nothing when relayInfo or other is nil", func(t *testing.T) {
		assert.NotPanics(t, func() {
			AppendClientInfo(nil, model.NewLogOther())
			AppendClientInfo(&relaycommon.RelayInfo{}, nil)
		})
	})
}

func newRelayLogAdminInfoContext(t *testing.T, upstreamBody string) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Set("use_channel", []string{"7"})
	req, err := http.NewRequest(http.MethodPost, "https://upstream.example.com/v1/chat/completions?key=secret", strings.NewReader("{}"))
	require.NoError(t, err)
	audit := relaycommon.NewUpstreamResponseAudit(req)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Proto:      "HTTP/1.1",
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(upstreamBody)),
	}
	audit.ObserveResponse(resp)
	_, err = io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.NoError(t, resp.Body.Close())
	relaycommon.SetUpstreamResponseAudit(ctx, audit)
	return ctx
}

func adminInfoOf(t *testing.T, other *model.LogOther) map[string]any {
	t.Helper()
	adminInfo, ok := other.Snapshot()["admin_info"].(map[string]any)
	require.True(t, ok, "admin_info must be present")
	return adminInfo
}

func TestAppendRelayLogAdminInfoUpstreamModelAudit(t *testing.T) {
	t.Run("flags a mismatch when the upstream response declares a different model", func(t *testing.T) {
		ctx := newRelayLogAdminInfoContext(t, `{"model":"gpt-4o-2024-08-06","choices":[{"finish_reason":"stop"}]}`)
		relayInfo := &relaycommon.RelayInfo{
			OriginModelName: "gpt-4o-alias",
			RetryIndex:      1,
			ChannelMeta: &relaycommon.ChannelMeta{
				ChannelType:       1,
				ChannelBaseUrl:    "https://upstream.example.com",
				UpstreamModelName: "gpt-4o",
				IsModelMapped:     true,
				HeadersOverride:   map[string]any{"X-Custom": "v", "Authorization": "secret"},
			},
		}
		relayInfo.SetEstimatePromptTokens(42)
		other := model.NewLogOther()

		AppendRelayLogAdminInfo(ctx, relayInfo, other)

		adminInfo := adminInfoOf(t, other)
		assert.Equal(t, "gpt-4o-2024-08-06", adminInfo["upstream_response_model"])
		assert.Equal(t, true, adminInfo["upstream_model_mismatch"])
		assert.Equal(t, "gpt-4o", adminInfo["sent_model"])
		assert.Equal(t, "gpt-4o-alias → gpt-4o", adminInfo["model_mapping_chain"])
		assert.Equal(t, 1, adminInfo["retry_index"])
		assert.Equal(t, 1, adminInfo["channel_type"])
		assert.Equal(t, "https://upstream.example.com", adminInfo["channel_base_url"])
		assert.Equal(t, 42, adminInfo["estimated_prompt_tokens"])
		assert.Equal(t, []string{"Authorization", "X-Custom"}, adminInfo["header_override_keys"], "only header names are recorded, never values")

		upstream, ok := adminInfo["upstream"].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "https://upstream.example.com/v1/chat/completions", upstream["endpoint"])
		assert.Equal(t, http.StatusOK, upstream["status_code"])
		assert.Equal(t, "stop", upstream["finish_reason"])
	})

	t.Run("reports a match when the upstream echoes the sent model ignoring case", func(t *testing.T) {
		ctx := newRelayLogAdminInfoContext(t, `{"model":"GPT-4o"}`)
		relayInfo := &relaycommon.RelayInfo{
			OriginModelName: "gpt-4o",
			ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "gpt-4o"},
		}
		other := model.NewLogOther()

		AppendRelayLogAdminInfo(ctx, relayInfo, other)

		adminInfo := adminInfoOf(t, other)
		assert.Equal(t, false, adminInfo["upstream_model_mismatch"])
		_, hasChain := adminInfo["model_mapping_chain"]
		assert.False(t, hasChain, "identical request and upstream model needs no mapping chain")
	})

	t.Run("omits the mismatch flag when the upstream response declares no model", func(t *testing.T) {
		ctx := newRelayLogAdminInfoContext(t, `{"error":{"message":"boom"}}`)
		relayInfo := &relaycommon.RelayInfo{
			OriginModelName: "gpt-4o",
			ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "gpt-4o"},
		}
		other := model.NewLogOther()

		AppendRelayLogAdminInfo(ctx, relayInfo, other)

		adminInfo := adminInfoOf(t, other)
		_, hasMismatch := adminInfo["upstream_model_mismatch"]
		assert.False(t, hasMismatch)
		_, hasModel := adminInfo["upstream_response_model"]
		assert.False(t, hasModel)
		_, hasUpstream := adminInfo["upstream"]
		assert.True(t, hasUpstream, "http exchange facts are still recorded")
	})

	t.Run("keeps every new field out of the user-visible projection", func(t *testing.T) {
		ctx := newRelayLogAdminInfoContext(t, `{"model":"gpt-4o-2024-08-06"}`)
		relayInfo := &relaycommon.RelayInfo{
			OriginModelName: "gpt-4o",
			ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "gpt-4o", ChannelBaseUrl: "https://upstream.example.com"},
		}
		other := model.NewLogOther()

		AppendRelayLogAdminInfo(ctx, relayInfo, other)

		for key := range other.Snapshot() {
			assert.Equal(t, "admin_info", key, "relay admin diagnostics must only live under admin_info")
		}
	})
}

func TestAppendUpstreamUsageAdminInfo(t *testing.T) {
	other := model.NewLogOther()

	AppendUpstreamUsageAdminInfo(other, &dto.Usage{
		PromptTokens:     100,
		CompletionTokens: 20,
		TotalTokens:      120,
		UsageSource:      dto.BillingUsageSourceOAIChat,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 60,
		},
	})

	adminInfo := adminInfoOf(t, other)
	assert.Equal(t, map[string]any{
		"prompt_tokens":     100,
		"completion_tokens": 20,
		"total_tokens":      120,
		"cached_tokens":     60,
		"source":            dto.BillingUsageSourceOAIChat,
	}, adminInfo["upstream_usage"])

	AppendUpstreamUsageAdminInfo(other, nil)
	assert.NotNil(t, adminInfoOf(t, other)["upstream_usage"], "nil usage leaves the existing snapshot untouched")
}
