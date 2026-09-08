package plugins_test

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	builtinplugins "github.com/QuantumNous/new-api/plugins"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestXaiResponsesProtocol(t *testing.T) {
	testVideoResponsesProtocol(t, videoResponsesTestCase{
		pluginKey: "xai",
		model:     "grok-imagine-video-1.5",
		requestBody: map[string]any{
			"model":   "grok-imagine-video-1.5",
			"input":   "a rocket launching from the red dunes of Mars",
			"seconds": 8,
			"size":    "1280x720",
		},
		wantAction: "text_to_video",
		wantRequest: map[string]any{
			"model":        "grok-imagine-video-1.5",
			"prompt":       "a rocket launching from the red dunes of Mars",
			"duration":     float64(8),
			"resolution":   "720p",
			"aspect_ratio": "16:9",
		},
		wantUsageKeys:  []string{"resolution", "seconds"},
		wantVendorName: "xai",
	})
}

func loadXaiPlugin(t *testing.T) *jsplugin.LoadedPlugin {
	t.Helper()
	source, err := builtinplugins.Source("xai")
	require.NoError(t, err)
	plugin, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: "xai"})
	require.NoError(t, err)
	return plugin
}

func decodeXaiVideoRequest(t *testing.T, plugin *jsplugin.LoadedPlugin, model string, body map[string]any) (map[string]any, error) {
	t.Helper()
	value, err := plugin.Engine.CallPath(
		t.Context(),
		"protocols",
		[]string{"openai_video", "decodeRequest"},
		map[string]any{
			"body":          map[string]any{"kind": "json", "value": body},
			"model":         model,
			"upstreamModel": model,
		},
	)
	if err != nil {
		return nil, err
	}
	encoded, marshalErr := common.Marshal(value)
	require.NoError(t, marshalErr)
	var resolved map[string]any
	require.NoError(t, common.Unmarshal(encoded, &resolved))
	requestBody, ok := resolved["requestBody"].(map[string]any)
	require.True(t, ok)
	requestBody["__action"] = resolved["action"]
	return requestBody, nil
}

// The gateway prices xAI video per second from the `duration` and `resolution`
// keys of the decoded request body (relay/helper/video_price.go). Every accepted
// client spelling must therefore normalize onto exactly those two keys.
func TestXaiVideoDecodeNormalizesBillingFacts(t *testing.T) {
	plugin := loadXaiPlugin(t)

	cases := []struct {
		name           string
		model          string
		body           map[string]any
		wantDuration   float64
		wantResolution string
		wantRatio      string
		wantAction     string
	}{
		{
			name:           "openai video spelling",
			model:          "grok-imagine-video",
			body:           map[string]any{"prompt": "a kite", "seconds": 6, "size": "720x1280"},
			wantDuration:   6,
			wantResolution: "720p",
			wantRatio:      "9:16",
			wantAction:     "text_to_video",
		},
		{
			name:           "vendor native spelling",
			model:          "grok-imagine-video",
			body:           map[string]any{"prompt": "a kite", "duration": 12, "resolution": "480p", "aspect_ratio": "4:3"},
			wantDuration:   12,
			wantResolution: "480p",
			wantRatio:      "4:3",
			wantAction:     "text_to_video",
		},
		{
			name:           "defaults when the client omits both",
			model:          "grok-imagine-video",
			body:           map[string]any{"prompt": "a kite"},
			wantDuration:   5,
			wantResolution: "480p",
			wantAction:     "text_to_video",
		},
		{
			name:           "image to video",
			model:          "grok-imagine-video",
			body:           map[string]any{"prompt": "a kite", "input_reference": "https://cdn.example/kite.png", "duration": 4},
			wantDuration:   4,
			wantResolution: "480p",
			wantAction:     "image_to_video",
		},
		{
			name:           "reference to video",
			model:          "grok-imagine-video-1.5",
			body:           map[string]any{"prompt": "a kite", "reference_images": []any{"https://cdn.example/a.png", "https://cdn.example/b.png"}},
			wantDuration:   5,
			wantResolution: "480p",
			wantAction:     "reference_to_video",
		},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			request, err := decodeXaiVideoRequest(t, plugin, testCase.model, testCase.body)
			require.NoError(t, err)
			assert.Equal(t, testCase.wantDuration, request["duration"])
			assert.Equal(t, testCase.wantResolution, request["resolution"])
			assert.Equal(t, testCase.wantAction, request["__action"])
			if testCase.wantRatio == "" {
				assert.NotContains(t, request, "aspect_ratio")
			} else {
				assert.Equal(t, testCase.wantRatio, request["aspect_ratio"])
			}
			assert.NotContains(t, request, "seconds", "a second duration key would trip the conflicting-duration guard")
			assert.NotContains(t, request, "size")
		})
	}
}

func TestXaiVideoDecodeRejectsUnbillableRequests(t *testing.T) {
	plugin := loadXaiPlugin(t)

	cases := []struct {
		name    string
		model   string
		body    map[string]any
		wantErr string
	}{
		{
			name:    "missing prompt",
			model:   "grok-imagine-video",
			body:    map[string]any{"duration": 5},
			wantErr: "field prompt is required",
		},
		{
			name:    "duration above the vendor ceiling",
			model:   "grok-imagine-video",
			body:    map[string]any{"prompt": "a kite", "duration": 60},
			wantErr: "between 1 and 15",
		},
		{
			name:    "fractional duration",
			model:   "grok-imagine-video",
			body:    map[string]any{"prompt": "a kite", "duration": 4.5},
			wantErr: "whole number of seconds",
		},
		{
			name:    "1080p on the base model",
			model:   "grok-imagine-video",
			body:    map[string]any{"prompt": "a kite", "resolution": "1080p"},
			wantErr: "supports at most 720p",
		},
		{
			name:    "1080p reference-to-video on 1.5",
			model:   "grok-imagine-video-1.5",
			body:    map[string]any{"prompt": "a kite", "resolution": "1080p", "reference_images": []any{"https://cdn.example/a.png"}},
			wantErr: "supports at most 720p",
		},
		{
			name:    "mutually exclusive modes",
			model:   "grok-imagine-video-1.5",
			body:    map[string]any{"prompt": "a kite", "image": "https://cdn.example/a.png", "reference_images": []any{"https://cdn.example/b.png"}},
			wantErr: "cannot be combined",
		},
		{
			name:    "unknown resolution",
			model:   "grok-imagine-video",
			body:    map[string]any{"prompt": "a kite", "resolution": "8k"},
			wantErr: "resolution must be one of",
		},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			_, err := decodeXaiVideoRequest(t, plugin, testCase.model, testCase.body)
			require.ErrorContains(t, err, testCase.wantErr)
		})
	}
}

func TestXaiVideoDecodeAllows1080pOnTheNewerModel(t *testing.T) {
	plugin := loadXaiPlugin(t)
	request, err := decodeXaiVideoRequest(t, plugin, "grok-imagine-video-1.5", map[string]any{
		"prompt":     "a kite",
		"resolution": "1080p",
		"duration":   15,
	})
	require.NoError(t, err)
	assert.Equal(t, "1080p", request["resolution"])
	assert.Equal(t, float64(15), request["duration"])
}

func TestXaiSubmitTargetsVendorGenerationEndpoint(t *testing.T) {
	plugin := loadXaiPlugin(t)
	value, err := plugin.Engine.Call(t.Context(), "buildSubmitRequest", map[string]any{
		"baseUrl":       "https://api.x.ai",
		"apiKey":        "xai-key",
		"model":         "grok-video",
		"upstreamModel": "grok-imagine-video-1.5",
		"requestBody":   map[string]any{"model": "grok-video", "prompt": "a kite", "duration": 8, "resolution": "720p"},
	})
	require.NoError(t, err)
	encoded, marshalErr := common.Marshal(value)
	require.NoError(t, marshalErr)
	var descriptor map[string]any
	require.NoError(t, common.Unmarshal(encoded, &descriptor))

	assert.Equal(t, "https://api.x.ai/v1/videos/generations", descriptor["url"])
	assert.Equal(t, "POST", descriptor["method"])
	body, ok := descriptor["body"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "grok-imagine-video-1.5", body["model"], "the upstream body carries the mapped model")
	assert.Equal(t, float64(8), body["duration"])
	assert.Equal(t, "720p", body["resolution"])
}

func TestXaiParseSubmitAndTaskResult(t *testing.T) {
	plugin := loadXaiPlugin(t)

	submitted, err := plugin.Engine.Call(t.Context(), "parseSubmitResponse",
		map[string]any{},
		map[string]any{"body": map[string]any{"request_id": "d97415a1-5796-b7ec-379f-4e6819e08fdf"}},
	)
	require.NoError(t, err)
	encoded, marshalErr := common.Marshal(submitted)
	require.NoError(t, marshalErr)
	var submitResult map[string]any
	require.NoError(t, common.Unmarshal(encoded, &submitResult))
	assert.Equal(t, "d97415a1-5796-b7ec-379f-4e6819e08fdf", submitResult["taskId"])

	cases := []struct {
		name       string
		body       map[string]any
		wantStatus string
		wantURL    string
		wantReason string
	}{
		{
			name:       "pending",
			body:       map[string]any{"status": "pending"},
			wantStatus: "IN_PROGRESS",
		},
		{
			name:       "done",
			body:       map[string]any{"status": "done", "video": map[string]any{"url": "https://vidgen.x.ai/a/video.mp4", "duration": 8}},
			wantStatus: "SUCCESS",
			wantURL:    "https://vidgen.x.ai/a/video.mp4",
		},
		{
			name:       "failed carries the vendor message",
			body:       map[string]any{"status": "failed", "error": map[string]any{"code": "invalid_argument", "message": "Prompt cannot be empty."}},
			wantStatus: "FAILURE",
			wantReason: "Prompt cannot be empty.",
		},
		{
			name:       "expired is terminal",
			body:       map[string]any{"status": "expired"},
			wantStatus: "FAILURE",
			wantReason: "the generation request expired",
		},
		{
			name:       "done without a video is not trusted as terminal",
			body:       map[string]any{"status": "done"},
			wantStatus: "UNKNOWN",
		},
		{
			name:       "unrecognized status is never guessed",
			body:       map[string]any{"status": "thinking"},
			wantStatus: "UNKNOWN",
		},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			value, callErr := plugin.Engine.Call(t.Context(), "parseTaskResult", map[string]any{}, testCase.body)
			require.NoError(t, callErr)
			body, marshalErr := common.Marshal(value)
			require.NoError(t, marshalErr)
			var result map[string]any
			require.NoError(t, common.Unmarshal(body, &result))
			assert.Equal(t, testCase.wantStatus, result["status"])
			if testCase.wantURL != "" {
				assert.Equal(t, testCase.wantURL, result["url"])
			}
			if testCase.wantReason != "" {
				assert.Equal(t, testCase.wantReason, result["reason"])
			}
		})
	}
}

// Settlement re-prices on the delivered duration, so a vendor clip shorter than
// the requested one must not be billed at the requested length.
func TestXaiCompletionUsageReportsDeliveredSeconds(t *testing.T) {
	plugin := loadXaiPlugin(t)
	value, err := plugin.Engine.Call(t.Context(), "extractUsageOnComplete",
		map[string]any{"status": "SUCCESS"},
		map[string]any{"status": "SUCCESS"},
		map[string]any{"status": "done", "video": map[string]any{"url": "https://vidgen.x.ai/a/video.mp4", "duration": 6}},
	)
	require.NoError(t, err)
	encoded, marshalErr := common.Marshal(value)
	require.NoError(t, marshalErr)
	var facts map[string]any
	require.NoError(t, common.Unmarshal(encoded, &facts))
	assert.Equal(t, map[string]any{"seconds": float64(6)}, facts)
}

func TestXaiArtifactProxiesTheVendorCdnWithoutCredentials(t *testing.T) {
	plugin := loadXaiPlugin(t)
	task := map[string]any{
		"status": "SUCCESS",
		"data":   map[string]any{"status": "done", "video": map[string]any{"url": "https://vidgen.x.ai/a/video.mp4?sig=secret"}},
	}

	listed, err := plugin.Engine.Call(t.Context(), "listArtifacts", task)
	require.NoError(t, err)
	encoded, marshalErr := common.Marshal(listed)
	require.NoError(t, marshalErr)
	var artifacts []map[string]any
	require.NoError(t, common.Unmarshal(encoded, &artifacts))
	require.Len(t, artifacts, 1)
	assert.Equal(t, "video", artifacts[0]["key"])
	assert.Equal(t, "video", artifacts[0]["type"])

	pending, err := plugin.Engine.Call(t.Context(), "listArtifacts", map[string]any{"status": "IN_PROGRESS", "data": map[string]any{}})
	require.NoError(t, err)
	pendingEncoded, marshalErr := common.Marshal(pending)
	require.NoError(t, marshalErr)
	var pendingArtifacts []map[string]any
	require.NoError(t, common.Unmarshal(pendingEncoded, &pendingArtifacts))
	assert.Empty(t, pendingArtifacts)

	contentContext := map[string]any{
		"status":        "SUCCESS",
		"data":          task["data"],
		"artifactKey":   "video",
		"baseUrl":       "https://api.x.ai",
		"apiKey":        "xai-key",
		"clientRequest": map[string]any{"method": "GET"},
	}
	value, err := plugin.Engine.Call(t.Context(), "buildContentRequest", contentContext)
	require.NoError(t, err)
	contentEncoded, marshalErr := common.Marshal(value)
	require.NoError(t, marshalErr)
	var descriptor map[string]any
	require.NoError(t, common.Unmarshal(contentEncoded, &descriptor))
	assert.Equal(t, "https://vidgen.x.ai/a/video.mp4?sig=secret", descriptor["url"])
	assert.Equal(t, true, descriptor["credentialless"])
	assert.NotContains(t, descriptor, "headers")

	contentContext["artifactKey"] = "audio"
	_, err = plugin.Engine.Call(t.Context(), "buildContentRequest", contentContext)
	require.ErrorContains(t, err, "artifact_not_found")
}
