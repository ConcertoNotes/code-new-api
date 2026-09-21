package common

import (
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newAuditWithBody(t *testing.T, contentType string, body string, headers map[string]string) *UpstreamResponseAudit {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, "https://api.example.com/v1/chat/completions?key=secret", strings.NewReader("{}"))
	require.NoError(t, err)
	audit := NewUpstreamResponseAudit(req)
	resp := &http.Response{
		StatusCode: 200,
		Proto:      "HTTP/2.0",
		Header:     http.Header{"Content-Type": []string{contentType}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	for name, value := range headers {
		resp.Header.Set(name, value)
	}
	audit.ObserveResponse(resp)
	data, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, body, string(data), "audit reader must be transparent to the handler")
	require.NoError(t, resp.Body.Close())
	return audit
}

func TestUpstreamResponseAuditSummary(t *testing.T) {
	tests := []struct {
		name        string
		contentType string
		body        string
		want        UpstreamResponseSummary
	}{
		{
			name:        "openai chat stream declares model in every chunk",
			contentType: "text/event-stream",
			body: "data: {\"id\":\"1\",\"model\":\"gpt-4o-2024-08-06\",\"choices\":[{\"delta\":{\"content\":\"hi\"},\"finish_reason\":null}]}\n\n" +
				"data: {\"id\":\"1\",\"model\":\"gpt-4o-2024-08-06\",\"service_tier\":\"default\",\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n" +
				"data: [DONE]\n\n",
			want: UpstreamResponseSummary{Model: "gpt-4o-2024-08-06", FinishReason: "stop", ServiceTier: "default"},
		},
		{
			name:        "claude stream reads model from message_start and stop_reason from message_delta",
			contentType: "text/event-stream",
			body: "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"model\":\"claude-sonnet-4-5-20250929\",\"usage\":{\"speed\":\"fast\"}}}\n\n" +
				"event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"delta\":{\"text\":\"x\"}}\n\n" +
				"event: message_delta\ndata: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\"}}\n\n",
			want: UpstreamResponseSummary{Model: "claude-sonnet-4-5-20250929", FinishReason: "end_turn", ServiceTier: "fast"},
		},
		{
			name:        "responses stream lets the terminal event override the created model",
			contentType: "text/event-stream",
			body: "event: response.created\ndata: {\"type\":\"response.created\",\"response\":{\"model\":\"gpt-5\",\"status\":\"in_progress\"}}\n\n" +
				"event: response.completed\ndata: {\"type\":\"response.completed\",\"response\":{\"model\":\"gpt-5-2025-08-07\",\"status\":\"completed\",\"service_tier\":\"priority\"}}\n\n",
			want: UpstreamResponseSummary{Model: "gpt-5-2025-08-07", ModelConflict: true, FinishReason: "completed", ServiceTier: "priority"},
		},
		{
			name:        "gemini non-stream reads modelVersion and finishReason",
			contentType: "application/json",
			body:        `{"candidates":[{"content":{"parts":[{"text":"hi"}]},"finishReason":"STOP"}],"modelVersion":"gemini-2.5-pro"}`,
			want:        UpstreamResponseSummary{Model: "gemini-2.5-pro", FinishReason: "STOP"},
		},
		{
			name:        "openai non-stream reads top level model",
			contentType: "application/json",
			body:        `{"id":"chatcmpl-1","model":"gpt-4o-mini","choices":[{"message":{"content":"hi"},"finish_reason":"length"}]}`,
			want:        UpstreamResponseSummary{Model: "gpt-4o-mini", FinishReason: "length"},
		},
		{
			name:        "malformed stream frames are ignored",
			contentType: "text/event-stream",
			body:        "data: {\"model\":\"broken\n\ndata: {\"model\":\"gpt-4.1\",\"choices\":[]}\n\n",
			want:        UpstreamResponseSummary{Model: "gpt-4.1"},
		},
		{
			name:        "empty body yields empty summary",
			contentType: "application/json",
			body:        "",
			want:        UpstreamResponseSummary{},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			audit := newAuditWithBody(t, tt.contentType, tt.body, nil)
			assert.Equal(t, tt.want, audit.Summary())
		})
	}
}

func TestUpstreamResponseAuditSummaryTruncatedNonStreamBody(t *testing.T) {
	// Gemini puts modelVersion after the candidates; a huge inline image pushes it past the head sample.
	filler := strings.Repeat("A", upstreamAuditHeadLimit*2)
	body := `{"candidates":[{"content":{"parts":[{"inlineData":{"data":"` + filler + `"}}]},"finishReason":"STOP"}],"modelVersion":"gemini-2.5-flash-image"}`

	audit := newAuditWithBody(t, "application/json", body, nil)

	assert.Equal(t, UpstreamResponseSummary{Model: "gemini-2.5-flash-image", FinishReason: "STOP"}, audit.Summary())
	assert.Equal(t, int64(len(body)), audit.ResponseBodyBytes())
}

func TestUpstreamResponseAuditAdminInfo(t *testing.T) {
	audit := newAuditWithBody(t, "application/json", `{"model":"gpt-4o","choices":[{"finish_reason":"stop"}]}`, map[string]string{
		"openai-processing-ms":         "123",
		"x-ratelimit-remaining-tokens": "999",
		"X-RateLimit-Limit-Requests":   "10000",
		"Set-Cookie":                   "secret=1",
	})

	info := audit.AdminInfo(audit.Summary())

	assert.Equal(t, "https://api.example.com/v1/chat/completions", info["endpoint"], "query string must be stripped")
	assert.Equal(t, http.MethodPost, info["method"])
	assert.Equal(t, 200, info["status_code"])
	assert.Equal(t, "HTTP/2.0", info["proto"])
	assert.Equal(t, "application/json", info["content_type"])
	assert.Equal(t, int64(123), info["processing_ms"])
	assert.Equal(t, "stop", info["finish_reason"])
	assert.Equal(t, int64(2), info["request_bytes"])
	assert.Equal(t, map[string]string{
		"x-ratelimit-remaining-tokens": "999",
		"x-ratelimit-limit-requests":   "10000",
	}, info["ratelimit"])
	_, hasTier := info["service_tier"]
	assert.False(t, hasTier)
}

func TestSanitizeUpstreamEndpoint(t *testing.T) {
	u, err := url.Parse("https://generativelanguage.googleapis.com/v1beta/models/gemini:streamGenerateContent?alt=sse&key=AIza")
	require.NoError(t, err)
	assert.Equal(t, "https://generativelanguage.googleapis.com/v1beta/models/gemini:streamGenerateContent", sanitizeUpstreamEndpoint(u))
}

func TestUpstreamModelsMatchForAudit(t *testing.T) {
	assert.True(t, UpstreamModelsMatchForAudit("GPT-4o", " gpt-4o "))
	assert.False(t, UpstreamModelsMatchForAudit("gpt-4o", "gpt-4o-2024-08-06"))
	assert.False(t, UpstreamModelsMatchForAudit("", "gpt-4o"))
}

func TestUpstreamResponseAuditAdminInfoWithoutResponse(t *testing.T) {
	req, err := http.NewRequest(http.MethodPost, "https://down.example.com/v1/messages", nil)
	require.NoError(t, err)
	audit := NewUpstreamResponseAudit(req)

	info := audit.AdminInfo(audit.Summary())

	assert.Equal(t, "https://down.example.com/v1/messages", info["endpoint"])
	assert.Equal(t, http.MethodPost, info["method"])
	assert.Contains(t, info, "duration_ms")
	for _, key := range []string{"status_code", "proto", "ttfb_ms", "response_bytes", "content_type"} {
		_, exists := info[key]
		assert.False(t, exists, "%s must be absent when no response headers arrived", key)
	}
}
