package sora

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSoraEstimateBillingUsesDurationOnlyForResolutionPricing(t *testing.T) {
	savedVideoPrices := ratio_setting.VideoGenerationPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateVideoGenerationPriceByJSONString(savedVideoPrices))
	})
	require.NoError(t, ratio_setting.UpdateVideoGenerationPriceByJSONString(
		`{"seedance-2.0":{"1080p":0.7}}`,
	))

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{
		Resolution: "1920x1080",
		Duration:   6,
	})
	info := &relaycommon.RelayInfo{
		OriginModelName: "seedance-2.0",
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
	}

	assert.Equal(t, map[string]float64{"seconds": 6}, (&TaskAdaptor{}).EstimateBilling(ctx, info))
}

func TestSoraBuildRequestURLPreservesVideoGenerationEndpoint(t *testing.T) {
	adaptor := &TaskAdaptor{baseURL: "https://video.example.com"}

	tests := []struct {
		name        string
		requestPath string
		taskInfo    *relaycommon.TaskRelayInfo
		want        string
	}{
		{
			name:        "standard OpenAI video endpoint",
			requestPath: "/v1/videos",
			taskInfo:    &relaycommon.TaskRelayInfo{},
			want:        "https://video.example.com/v1/videos",
		},
		{
			name:        "video generations endpoint",
			requestPath: "/v1/video/generations",
			taskInfo:    &relaycommon.TaskRelayInfo{},
			want:        "https://video.example.com/v1/video/generations",
		},
		{
			name:        "remix remains on standard endpoint",
			requestPath: "/v1/video/generations",
			taskInfo: &relaycommon.TaskRelayInfo{
				Action:       constant.TaskActionRemix,
				OriginTaskID: "video_123",
			},
			want: "https://video.example.com/v1/videos/video_123/remix",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url, err := adaptor.BuildRequestURL(&relaycommon.RelayInfo{
				RequestURLPath: tt.requestPath,
				TaskRelayInfo:  tt.taskInfo,
			})
			require.NoError(t, err)
			assert.Equal(t, tt.want, url)
		})
	}
}

func TestSoraBuildRequestBodyReturnsReplayablePassThroughBody(t *testing.T) {
	payload := []byte("opaque-sora-request-body")
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/octet-stream")
	defer common.CleanupBodyStorage(c)

	info := &relaycommon.RelayInfo{}
	body, err := (&TaskAdaptor{}).BuildRequestBody(c, info)
	require.NoError(t, err)
	replayable, ok := body.(common.ReplayableBody)
	require.True(t, ok)

	sent, err := io.ReadAll(body)
	require.NoError(t, err)
	assert.Equal(t, payload, sent)
	assert.EqualValues(t, len(payload), replayable.Size())

	replayBody, err := replayable.NewReader()
	require.NoError(t, err)
	replay, err := io.ReadAll(replayBody)
	require.NoError(t, err)
	require.NoError(t, replayBody.Close())
	assert.Equal(t, payload, replay)
}

func TestGrokBuildRequestBodyConvertsMultipartToJSON(t *testing.T) {
	var form bytes.Buffer
	writer := multipart.NewWriter(&form)
	require.NoError(t, writer.WriteField("model", "grok-imagine-video"))
	require.NoError(t, writer.WriteField("prompt", "生成一份樱花的视频"))
	require.NoError(t, writer.WriteField("seconds", "4"))
	require.NoError(t, writer.WriteField("size", "1280x720"))
	require.NoError(t, writer.Close())

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewReader(form.Bytes()))
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	defer common.CleanupBodyStorage(c)

	body, err := (&TaskAdaptor{}).BuildRequestBody(c, &relaycommon.RelayInfo{
		OriginModelName: "grok-imagine-video",
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "grok-imagine-video-1.5"},
	})
	require.NoError(t, err)
	requestBody, err := io.ReadAll(body)
	require.NoError(t, err)

	var payload map[string]interface{}
	require.NoError(t, common.Unmarshal(requestBody, &payload))
	assert.Equal(t, "grok-imagine-video-1.5", payload["model"])
	assert.Equal(t, "生成一份樱花的视频", payload["prompt"])
	assert.Equal(t, float64(4), payload["duration"])
	assert.Equal(t, "720p", payload["resolution"])
	assert.NotContains(t, payload, "seconds")
	assert.NotContains(t, payload, "size")
	assert.Equal(t, "application/json", c.Request.Header.Get("Content-Type"))
}

func TestGrokDoResponseUsesRequestID(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewBufferString(`{"request_id":"req_123","status":"pending"}`)),
	}
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"}}

	taskID, data, taskErr := (&TaskAdaptor{}).DoResponse(c, resp, info)
	require.Nil(t, taskErr)
	assert.Equal(t, "req_123", taskID)
	assert.Contains(t, string(data), "req_123")
}

func TestSoraParseTaskResultKeepsUnknownStatusInProgress(t *testing.T) {
	task, err := (&TaskAdaptor{}).ParseTaskResult([]byte(`{"id":"task_upstream","status":"unknown","progress":0}`))
	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusInProgress, task.Status)
}

func TestSoraConvertToOpenAIVideoUsesLatestStoredStatus(t *testing.T) {
	task := &model.Task{
		TaskID:   "task_public",
		Status:   model.TaskStatusSuccess,
		Progress: "100%",
		Data:     []byte(`{"id":"task_upstream","status":"unknown","progress":0}`),
	}

	data, err := (&TaskAdaptor{}).ConvertToOpenAIVideo(task)
	require.NoError(t, err)
	var response map[string]any
	require.NoError(t, common.Unmarshal(data, &response))
	assert.Equal(t, "task_public", response["id"])
	assert.Equal(t, "completed", response["status"])
	assert.Equal(t, float64(100), response["progress"])
}
