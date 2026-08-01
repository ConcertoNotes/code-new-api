package deepseek

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClaudeRequestUsesOpenAICompatibleUpstream(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatClaude,
		RelayMode:       relayconstant.RelayModeChatCompletions,
		RequestURLPath:  "/v1/messages",
		OriginModelName: "deepseek-v4-flash",
		IsStream:        true,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:          constant.ChannelTypeDeepSeek,
			ChannelBaseUrl:       "https://api.example.com",
			UpstreamModelName:    "deepseek-v4-flash",
			SupportStreamOptions: true,
		},
	}
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)

	request := &dto.ClaudeRequest{
		Model: "deepseek-v4-flash",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "hello"},
		},
	}
	converted, err := (&Adaptor{}).ConvertClaudeRequest(c, info, request)
	require.NoError(t, err)

	openAIRequest, ok := converted.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	require.Len(t, openAIRequest.Messages, 1)
	assert.Equal(t, "user", openAIRequest.Messages[0].Role)
	assert.Equal(t, "hello", openAIRequest.Messages[0].Content)
	require.NotNil(t, openAIRequest.StreamOptions)
	assert.True(t, openAIRequest.StreamOptions.IncludeUsage)

	requestURL, err := (&Adaptor{}).GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://api.example.com/v1/chat/completions", requestURL)
}
