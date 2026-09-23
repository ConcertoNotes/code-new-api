package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseQualityTestStreamEventExtractsTextAndUsagePerFormat(t *testing.T) {
	intPtr := func(v int) *int { return &v }
	tests := []struct {
		name string
		data string
		want qualityTestStreamEvent
	}{
		{
			name: "openai chat delta",
			data: `{"object":"chat.completion.chunk","model":"gpt-5","choices":[{"delta":{"content":"<svg>"}}]}`,
			want: qualityTestStreamEvent{Text: "<svg>", Model: "gpt-5"},
		},
		{
			name: "openai chat usage chunk",
			data: `{"object":"chat.completion.chunk","model":"gpt-5","choices":[],"usage":{"prompt_tokens":12,"completion_tokens":340,"completion_tokens_details":{"reasoning_tokens":200}}}`,
			want: qualityTestStreamEvent{Model: "gpt-5", InputTokens: intPtr(12), OutputTokens: intPtr(340), ReasoningTokens: intPtr(200)},
		},
		{
			name: "responses text delta",
			data: `{"type":"response.output_text.delta","delta":"<html>"}`,
			want: qualityTestStreamEvent{Text: "<html>"},
		},
		{
			name: "responses completed usage",
			data: `{"type":"response.completed","response":{"model":"gpt-5-codex","usage":{"input_tokens":30,"output_tokens":900,"output_tokens_details":{"reasoning_tokens":512}}}}`,
			want: qualityTestStreamEvent{Model: "gpt-5-codex", InputTokens: intPtr(30), OutputTokens: intPtr(900), ReasoningTokens: intPtr(512)},
		},
		{
			name: "responses failed",
			data: `{"type":"response.failed","response":{"error":{"message":"quota exceeded"}}}`,
			want: qualityTestStreamEvent{Error: "quota exceeded"},
		},
		{
			name: "anthropic message start",
			data: `{"type":"message_start","message":{"model":"claude-opus","usage":{"input_tokens":25}}}`,
			want: qualityTestStreamEvent{Model: "claude-opus", InputTokens: intPtr(25)},
		},
		{
			name: "anthropic thinking delta is not answer text",
			data: `{"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"plan"}}`,
			want: qualityTestStreamEvent{},
		},
		{
			name: "anthropic text delta",
			data: `{"type":"content_block_delta","delta":{"type":"text_delta","text":"<div>"}}`,
			want: qualityTestStreamEvent{Text: "<div>"},
		},
		{
			name: "anthropic message delta usage",
			data: `{"type":"message_delta","usage":{"output_tokens":777}}`,
			want: qualityTestStreamEvent{OutputTokens: intPtr(777)},
		},
		{name: "done sentinel", data: `[DONE]`, want: qualityTestStreamEvent{}},
		{name: "invalid json", data: `{"type":`, want: qualityTestStreamEvent{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, parseQualityTestStreamEvent([]byte(tt.data)))
		})
	}
}

func TestQualityTestStreamWriterReassemblesLinesSplitAcrossWrites(t *testing.T) {
	var text string
	writer := &qualityTestStreamWriter{onEvent: func(event qualityTestStreamEvent) { text += event.Text }}

	chunks := []string{
		"event: response.output_text.delta\ndata: {\"type\":\"response.output_text.",
		"delta\",\"delta\":\"<svg>\"}\n\ndata: {\"type\":\"response.output_text.delta\",\"delta\":\"</svg>\"}",
		"\n\n",
	}
	for _, chunk := range chunks {
		written, err := writer.Write([]byte(chunk))
		require.NoError(t, err)
		assert.Equal(t, len(chunk), written)
	}
	assert.Equal(t, "<svg></svg>", text)
}

func TestBuildQualityTestRequestMapsEffortPerEndpoint(t *testing.T) {
	chat, err := buildQualityTestRequest(string(constant.EndpointTypeOpenAI), "gpt-5", "draw", "high")
	require.NoError(t, err)
	chatRequest := chat.(*dto.GeneralOpenAIRequest)
	assert.Equal(t, "high", chatRequest.ReasoningEffort)
	require.NotNil(t, chatRequest.StreamOptions)
	assert.True(t, chatRequest.StreamOptions.IncludeUsage, "流式请求必须带回 usage")

	responses, err := buildQualityTestRequest(string(constant.EndpointTypeOpenAIResponse), "gpt-5-codex", "draw", "")
	require.NoError(t, err)
	assert.Nil(t, responses.(*dto.OpenAIResponsesRequest).Reasoning, "默认强度不下发 reasoning")

	claude, err := buildQualityTestRequest(string(constant.EndpointTypeAnthropic), "claude-opus", "draw", "max")
	require.NoError(t, err)
	claudeRequest := claude.(*dto.ClaudeRequest)
	assert.Equal(t, "max", claudeRequest.GetEfforts())
	require.NotNil(t, claudeRequest.Thinking)
	assert.Equal(t, "adaptive", claudeRequest.Thinking.Type)
}
