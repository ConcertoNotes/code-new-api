package plugins_test

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	builtinplugins "github.com/QuantumNous/new-api/plugins"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestXaiRelayResponsesProtocol(t *testing.T) {
	testVideoResponsesProtocol(t, videoResponsesTestCase{
		pluginKey: "xai-relay",
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

func loadGrokImagineProvider(t *testing.T, key string) *jsplugin.LoadedPlugin {
	t.Helper()
	source, err := builtinplugins.Source(key)
	require.NoError(t, err)
	plugin, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: key})
	require.NoError(t, err)
	return plugin
}

// `xai` and `xai-relay` deliberately claim the same two models on the same
// shared endpoints; the host is expected to keep both bindings and pick one by
// channel type at distribution. If that ever regresses into a registration
// conflict the process panics at startup, so assert the shape directly.
func TestGrokImagineProvidersShareTheSameModelEndpoints(t *testing.T) {
	generation := jsplugin.DefaultRegistry.Generation()
	require.NotNil(t, generation)

	native, found := generation.Get("xai")
	require.True(t, found)
	relay, found := generation.Get("xai-relay")
	require.True(t, found)

	for _, model := range []string{"grok-imagine-video", "grok-imagine-video-1.5"} {
		for _, endpoint := range []struct{ method, path string }{
			{"POST", "/v1/videos"},
			{"POST", "/v1/responses"},
		} {
			t.Run(model+" "+endpoint.path, func(t *testing.T) {
				candidates := generation.LookupEndpointCandidates(endpoint.method, endpoint.path, model)
				require.Len(t, candidates, 2, "both providers must stay bound to the shared endpoint")
				keys := []string{candidates[0].Plugin.Meta.Key, candidates[1].Plugin.Meta.Key}
				assert.ElementsMatch(t, []string{"xai", "xai-relay"}, keys)
			})
		}
	}

	byType, found := generation.GetByChannelType(48)
	require.True(t, found)
	assert.Same(t, native, byType, "an xAI channel must resolve to the native-format provider")

	byType, found = generation.GetByChannelType(60)
	require.True(t, found)
	assert.Same(t, relay, byType, "a New API channel must resolve to the upstream-relay provider")
}

func decodeGrokVideoRequest(t *testing.T, plugin *jsplugin.LoadedPlugin, model string, body map[string]any) map[string]any {
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
	require.NoError(t, err)
	encoded, marshalErr := common.Marshal(value)
	require.NoError(t, marshalErr)
	var resolved map[string]any
	require.NoError(t, common.Unmarshal(encoded, &resolved))
	requestBody, ok := resolved["requestBody"].(map[string]any)
	require.True(t, ok)
	return requestBody
}

// The host runs one provider's decodeRequest before channel selection and the
// *selected* provider's buildSubmitRequest after it, so a shared-model request
// can decode on `xai` and submit on `xai-relay`. Both normalizers must therefore
// agree exactly.
func TestGrokImagineDecodersProduceOneNormalizedBody(t *testing.T) {
	native := loadGrokImagineProvider(t, "xai")
	relay := loadGrokImagineProvider(t, "xai-relay")

	bodies := []map[string]any{
		{"prompt": "a kite", "seconds": 6, "size": "720x1280"},
		{"prompt": "a kite", "duration": 12, "resolution": "480p", "aspect_ratio": "4:3"},
		{"prompt": "a kite"},
		{"prompt": "a kite", "input_reference": "https://cdn.example/kite.png", "duration": 4},
		{"prompt": "a kite", "reference_images": []any{"https://cdn.example/a.png", "https://cdn.example/b.png"}},
	}
	for index, body := range bodies {
		t.Run(string(rune('a'+index)), func(t *testing.T) {
			nativeBody := decodeGrokVideoRequest(t, native, "grok-imagine-video", body)
			relayBody := decodeGrokVideoRequest(t, relay, "grok-imagine-video", body)
			assert.Equal(t, nativeBody, relayBody)
		})
	}
}

func TestXaiRelaySubmitTargetsTheUpstreamVideoGenerationsEndpoint(t *testing.T) {
	relay := loadGrokImagineProvider(t, "xai-relay")
	native := loadGrokImagineProvider(t, "xai")

	// Decode on the native provider to prove the cross-provider hand-off works
	// end to end, then submit through the relay.
	requestBody := decodeGrokVideoRequest(t, native, "grok-video", map[string]any{
		"prompt": "a kite", "seconds": 8, "size": "1280x720",
	})

	value, err := relay.Engine.Call(t.Context(), "buildSubmitRequest", map[string]any{
		"baseUrl":       "https://upstream.example",
		"apiKey":        "sk-upstream",
		"model":         "grok-video",
		"upstreamModel": "grok-imagine-video-1.5",
		"requestBody":   requestBody,
	})
	require.NoError(t, err)
	encoded, marshalErr := common.Marshal(value)
	require.NoError(t, marshalErr)
	var descriptor map[string]any
	require.NoError(t, common.Unmarshal(encoded, &descriptor))

	assert.Equal(t, "https://upstream.example/v1/video/generations", descriptor["url"])
	assert.Equal(t, "POST", descriptor["method"])
	body, ok := descriptor["body"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "grok-imagine-video-1.5", body["model"])
	assert.Equal(t, "a kite", body["prompt"])
	// new-api /v1/video/generations spelling.
	assert.Equal(t, float64(8), body["duration"])
	assert.Equal(t, float64(1280), body["width"])
	assert.Equal(t, float64(720), body["height"])
	assert.Equal(t, map[string]any{"resolution": "720p", "aspect_ratio": "16:9"}, body["metadata"])
	// OpenAI Videos spelling for a strict upstream parser.
	assert.Equal(t, float64(8), body["seconds"])
	assert.Equal(t, "1280x720", body["size"])
	// Vendor spelling for an upstream that prefers it.
	assert.Equal(t, "720p", body["resolution"])
	assert.Equal(t, "16:9", body["aspect_ratio"])
}

func TestXaiRelayRendersConventionalPixelSizes(t *testing.T) {
	relay := loadGrokImagineProvider(t, "xai-relay")

	cases := []struct {
		resolution string
		ratio      string
		wantSize   string
		wantWidth  float64
		wantHeight float64
	}{
		{"480p", "16:9", "854x480", 854, 480},
		{"480p", "9:16", "480x854", 480, 854},
		{"720p", "16:9", "1280x720", 1280, 720},
		{"1080p", "16:9", "1920x1080", 1920, 1080},
		{"720p", "1:1", "720x720", 720, 720},
		{"480p", "4:3", "640x480", 640, 480},
		{"480p", "3:2", "720x480", 720, 480},
	}
	for _, testCase := range cases {
		t.Run(testCase.resolution+" "+testCase.ratio, func(t *testing.T) {
			value, err := relay.Engine.Call(t.Context(), "buildSubmitRequest", map[string]any{
				"baseUrl":       "https://upstream.example",
				"apiKey":        "sk-upstream",
				"model":         "grok-imagine-video-1.5",
				"upstreamModel": "grok-imagine-video-1.5",
				"requestBody": map[string]any{
					"model": "grok-imagine-video-1.5", "prompt": "a kite",
					"duration": 5, "resolution": testCase.resolution, "aspect_ratio": testCase.ratio,
				},
			})
			require.NoError(t, err)
			encoded, marshalErr := common.Marshal(value)
			require.NoError(t, marshalErr)
			var descriptor map[string]any
			require.NoError(t, common.Unmarshal(encoded, &descriptor))
			body, ok := descriptor["body"].(map[string]any)
			require.True(t, ok)
			assert.Equal(t, testCase.wantSize, body["size"])
			assert.Equal(t, testCase.wantWidth, body["width"])
			assert.Equal(t, testCase.wantHeight, body["height"])
		})
	}
}

func TestXaiRelayPollingAndContent(t *testing.T) {
	relay := loadGrokImagineProvider(t, "xai-relay")

	queryValue, err := relay.Engine.Call(t.Context(), "buildQueryRequest", map[string]any{
		"baseUrl": "https://upstream.example",
		"apiKey":  "sk-upstream",
		"taskId":  "task upstream/1",
	})
	require.NoError(t, err)
	queryEncoded, marshalErr := common.Marshal(queryValue)
	require.NoError(t, marshalErr)
	var queryDescriptor map[string]any
	require.NoError(t, common.Unmarshal(queryEncoded, &queryDescriptor))
	assert.Equal(t, "https://upstream.example/v1/video/generations/task%20upstream%2F1", queryDescriptor["url"])
	assert.Equal(t, "GET", queryDescriptor["method"])

	// A new-api upstream wraps the submission in its generic task envelope; an
	// OpenAI-shaped one returns the video object directly.
	submitCases := []struct {
		name string
		body map[string]any
	}{
		{"new-api envelope", map[string]any{"code": "success", "data": map[string]any{"task_id": "task_upstream", "status": "NOT_START"}}},
		{"host fallback", map[string]any{"id": "task_upstream", "task_id": "task_upstream", "status": "queued"}},
		{"openai video object", map[string]any{"id": "task_upstream", "object": "video", "status": "queued"}},
	}
	for _, testCase := range submitCases {
		t.Run("submit "+testCase.name, func(t *testing.T) {
			submitted, callErr := relay.Engine.Call(t.Context(), "parseSubmitResponse",
				map[string]any{}, map[string]any{"body": testCase.body},
			)
			require.NoError(t, callErr)
			encoded, encodeErr := common.Marshal(submitted)
			require.NoError(t, encodeErr)
			var submitResult map[string]any
			require.NoError(t, common.Unmarshal(encoded, &submitResult))
			assert.Equal(t, "task_upstream", submitResult["taskId"])
		})
	}

	cases := []struct {
		name         string
		body         map[string]any
		wantStatus   string
		wantProgress string
		wantReason   string
		wantURL      string
	}{
		{name: "queued", body: map[string]any{"status": "queued"}, wantStatus: "QUEUED"},
		{
			name:         "in progress carries percent",
			body:         map[string]any{"status": "in_progress", "progress": 42},
			wantStatus:   "IN_PROGRESS",
			wantProgress: "42%",
		},
		{name: "completed", body: map[string]any{"status": "completed", "progress": 100}, wantStatus: "SUCCESS"},
		{
			name:       "failed carries the upstream message",
			body:       map[string]any{"status": "failed", "error": map[string]any{"message": "moderation blocked"}},
			wantStatus: "FAILURE",
			wantReason: "moderation blocked",
		},
		{name: "unrecognized status is never guessed", body: map[string]any{"status": "thinking"}, wantStatus: "UNKNOWN"},
		// The new-api task envelope: uppercase states, percent-suffixed progress,
		// fail_reason, and result_url.
		{
			name:         "envelope in progress",
			body:         map[string]any{"code": "success", "data": map[string]any{"status": "IN_PROGRESS", "progress": "30%"}},
			wantStatus:   "IN_PROGRESS",
			wantProgress: "30%",
		},
		{name: "envelope not started", body: map[string]any{"code": "success", "data": map[string]any{"status": "NOT_START"}}, wantStatus: "QUEUED"},
		{
			name: "envelope success carries the result url",
			body: map[string]any{"code": "success", "data": map[string]any{
				"status": "SUCCESS", "progress": "100%", "result_url": "https://upstream.example/v1/videos/task_upstream/content",
			}},
			wantStatus: "SUCCESS",
			wantURL:    "https://upstream.example/v1/videos/task_upstream/content",
		},
		{
			name:       "envelope failure carries fail_reason",
			body:       map[string]any{"code": "success", "data": map[string]any{"status": "FAILURE", "fail_reason": "upstream quota exhausted"}},
			wantStatus: "FAILURE",
			wantReason: "upstream quota exhausted",
		},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			value, callErr := relay.Engine.Call(t.Context(), "parseTaskResult", map[string]any{}, testCase.body)
			require.NoError(t, callErr)
			body, encodeErr := common.Marshal(value)
			require.NoError(t, encodeErr)
			var result map[string]any
			require.NoError(t, common.Unmarshal(body, &result))
			assert.Equal(t, testCase.wantStatus, result["status"])
			if testCase.wantProgress != "" {
				assert.Equal(t, testCase.wantProgress, result["progress"])
			}
			if testCase.wantReason != "" {
				assert.Equal(t, testCase.wantReason, result["reason"])
			}
			if testCase.wantURL != "" {
				assert.Equal(t, testCase.wantURL, result["url"])
			}
		})
	}

	// new-api exposes no content route under /v1/video/generations, and its
	// result_url may point at a vendor CDN this gateway cannot authenticate
	// against, so the bytes are proxied through the channel host instead.
	value, err := relay.Engine.Call(t.Context(), "buildContentRequest", map[string]any{
		"status":         "SUCCESS",
		"data":           map[string]any{"id": "task_upstream", "status": "completed"},
		"artifactKey":    "video",
		"upstreamTaskId": "task_upstream",
		"baseUrl":        "https://upstream.example",
		"apiKey":         "sk-upstream",
		"clientRequest":  map[string]any{"method": "GET"},
	})
	require.NoError(t, err)
	contentEncoded, marshalErr := common.Marshal(value)
	require.NoError(t, marshalErr)
	var descriptor map[string]any
	require.NoError(t, common.Unmarshal(contentEncoded, &descriptor))
	assert.Equal(t, "https://upstream.example/v1/videos/task_upstream/content", descriptor["url"])
	headers, ok := descriptor["headers"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "Bearer sk-upstream", headers["Authorization"])
	assert.NotContains(t, descriptor, "credentialless")

	completionCases := []struct {
		name string
		body map[string]any
	}{
		{"openai seconds", map[string]any{"status": "completed", "seconds": 6}},
		{"envelope metadata duration", map[string]any{"code": "success", "data": map[string]any{
			"status": "SUCCESS", "metadata": map[string]any{"duration": 6},
		}}},
		{"envelope raw vendor body", map[string]any{"code": "success", "data": map[string]any{
			"status": "SUCCESS", "data": map[string]any{"seconds": 6},
		}}},
	}
	for _, testCase := range completionCases {
		t.Run("usage "+testCase.name, func(t *testing.T) {
			completion, callErr := relay.Engine.Call(t.Context(), "extractUsageOnComplete",
				map[string]any{"status": "SUCCESS"},
				map[string]any{"status": "SUCCESS"},
				testCase.body,
			)
			require.NoError(t, callErr)
			completionEncoded, encodeErr := common.Marshal(completion)
			require.NoError(t, encodeErr)
			var facts map[string]any
			require.NoError(t, common.Unmarshal(completionEncoded, &facts))
			assert.Equal(t, map[string]any{"seconds": float64(6)}, facts)
		})
	}
}
