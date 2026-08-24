package helper

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func imageEditPNG(t *testing.T, width, height int, alpha bool) []byte {
	t.Helper()
	var img image.Image
	if alpha {
		rgba := image.NewNRGBA(image.Rect(0, 0, width, height))
		rgba.Set(0, 0, color.NRGBA{R: 255, A: 0})
		img = rgba
	} else {
		img = image.NewGray(image.Rect(0, 0, width, height))
	}
	var output bytes.Buffer
	require.NoError(t, png.Encode(&output, img))
	return output.Bytes()
}

func newGPTImage2EditContext(t *testing.T, imageBytes, maskBytes []byte) *gin.Context {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "gpt-image-2"))
	require.NoError(t, writer.WriteField("prompt", "edit the selected area"))
	imagePart, err := writer.CreateFormFile("image", "image.png")
	require.NoError(t, err)
	_, err = imagePart.Write(imageBytes)
	require.NoError(t, err)
	if maskBytes != nil {
		maskPart, err := writer.CreateFormFile("mask", "mask.png")
		require.NoError(t, err)
		_, err = maskPart.Write(maskBytes)
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	return c
}

// TestGetAndValidOpenAIImageRequestMultipartStream verifies multipart image
// edit parsing: the stream field is parsed and validated, and the request body
// stays replayable for the upstream request.
func TestGetAndValidOpenAIImageRequestMultipartStream(t *testing.T) {
	gin.SetMode(gin.TestMode)

	newContext := func(t *testing.T, streamValue string, withImage bool) (*gin.Context, string) {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		require.NoError(t, writer.WriteField("model", "gpt-image-1"))
		require.NoError(t, writer.WriteField("prompt", "edit this image"))
		require.NoError(t, writer.WriteField("stream", streamValue))
		if withImage {
			part, err := writer.CreateFormFile("image", "input.png")
			require.NoError(t, err)
			_, err = part.Write([]byte("fake image"))
			require.NoError(t, err)
		}
		require.NoError(t, writer.Close())
		originalBody := body.String()

		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
		c.Request.Header.Set("Content-Type", writer.FormDataContentType())
		return c, originalBody
	}

	t.Run("valid stream value keeps body replayable", func(t *testing.T) {
		c, originalBody := newContext(t, "true", true)

		req, err := GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesEdits)
		require.NoError(t, err)
		require.NotNil(t, req.Stream)
		require.True(t, *req.Stream)
		require.True(t, req.IsStream(c.Request))

		bodyAfterValidation, err := io.ReadAll(c.Request.Body)
		require.NoError(t, err)
		require.Equal(t, originalBody, string(bodyAfterValidation))

		form, err := common.ParseMultipartFormReusable(c)
		require.NoError(t, err)
		require.Equal(t, "true", url.Values(form.Value).Get("stream"))
		require.Len(t, form.File["image"], 1)
	})

	t.Run("invalid stream value is rejected", func(t *testing.T) {
		c, _ := newContext(t, "notabool", false)

		_, err := GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesEdits)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid stream value")
	})
}

// TestGetAndValidOpenAIImageRequestNBounds guards the billing invariant that
// the image generation count can never reach quota calculation with a value
// large enough to overflow int64 into a negative charge.
func TestGetAndValidOpenAIImageRequestNBounds(t *testing.T) {
	gin.SetMode(gin.TestMode)

	newJSONContext := func(t *testing.T, body string) *gin.Context {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", bytes.NewBufferString(body))
		c.Request.Header.Set("Content-Type", "application/json")
		return c
	}

	boundErr := fmt.Sprintf("n must be an integer between 1 and %d", dto.MaxImageN)

	tests := []struct {
		name    string
		body    string
		wantErr string
		wantN   uint
	}{
		{
			name:    "overflowed uint64 n is rejected",
			body:    `{"model":"gpt-image-1","prompt":"a cat","n":18446744073686646784}`,
			wantErr: boundErr,
		},
		{
			name:    "n above max is rejected",
			body:    fmt.Sprintf(`{"model":"gpt-image-1","prompt":"a cat","n":%d}`, dto.MaxImageN+1),
			wantErr: boundErr,
		},
		{
			name:  "n at max is accepted",
			body:  fmt.Sprintf(`{"model":"gpt-image-1","prompt":"a cat","n":%d}`, dto.MaxImageN),
			wantN: dto.MaxImageN,
		},
		{
			name:  "explicit n is accepted",
			body:  `{"model":"gpt-image-1","prompt":"a cat","n":3}`,
			wantN: 3,
		},
		{
			name:  "zero n defaults to 1",
			body:  `{"model":"gpt-image-1","prompt":"a cat","n":0}`,
			wantN: 1,
		},
		{
			name:  "absent n defaults to 1",
			body:  `{"model":"gpt-image-1","prompt":"a cat"}`,
			wantN: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newJSONContext(t, tt.body)
			req, err := GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
			if tt.wantErr != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErr)
				return
			}
			require.NoError(t, err)
			require.NotNil(t, req.N)
			require.Equal(t, tt.wantN, *req.N)
			require.Equal(t, float64(tt.wantN), req.GetTokenCountMeta().BillingRatios["n"])
		})
	}

	t.Run("negative multipart n is rejected", func(t *testing.T) {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		require.NoError(t, writer.WriteField("model", "gpt-image-1"))
		require.NoError(t, writer.WriteField("prompt", "edit this image"))
		require.NoError(t, writer.WriteField("n", "-22904832"))
		require.NoError(t, writer.Close())

		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
		c.Request.Header.Set("Content-Type", writer.FormDataContentType())

		_, err := GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesEdits)
		require.Error(t, err)
		require.Contains(t, err.Error(), boundErr)
	})
}

func TestGetAndValidOpenAIImageRequestNormalizesResolutionFromSize(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name           string
		body           string
		wantSize       string
		wantResolution string
	}{
		{
			name:           "size only determines tier",
			body:           `{"model":"gpt-image-2","prompt":"sakura","size":"2240x3168"}`,
			wantSize:       "2240x3168",
			wantResolution: "4K",
		},
		{
			name:           "resolution only determines tier",
			body:           `{"model":"gpt-image-2","prompt":"sakura","resolution":"2k"}`,
			wantResolution: "2K",
		},
		{
			name:           "size overrides resolution",
			body:           `{"model":"gpt-image-2","prompt":"sakura","size":"1536x1024","resolution":"4K"}`,
			wantSize:       "1536x1024",
			wantResolution: "2K",
		},
		{
			name:           "cherry default size yields to explicit prompt dimensions",
			body:           `{"model":"gpt-image-2","prompt":"生成一张樱花照片，大小为2240x3168","size":"1024x1024"}`,
			wantSize:       "2240x3168",
			wantResolution: "4K",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", bytes.NewBufferString(tt.body))
			c.Request.Header.Set("Content-Type", "application/json")

			request, err := GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
			require.NoError(t, err)
			require.NotNil(t, request.Resolution)
			assert.Equal(t, tt.wantSize, request.Size)
			assert.Equal(t, tt.wantResolution, *request.Resolution)
		})
	}
}

func TestGetAndValidOpenAIImageRequestValidatesGPTImage2Mask(t *testing.T) {
	gin.SetMode(gin.TestMode)
	imageBytes := imageEditPNG(t, 32, 24, true)

	t.Run("matching alpha mask is accepted", func(t *testing.T) {
		request, err := GetAndValidOpenAIImageRequest(
			newGPTImage2EditContext(t, imageBytes, imageEditPNG(t, 32, 24, true)),
			relayconstant.RelayModeImagesEdits,
		)
		require.NoError(t, err)
		assert.Equal(t, "gpt-image-2", request.Model)
	})

	t.Run("mask without alpha is rejected", func(t *testing.T) {
		_, err := GetAndValidOpenAIImageRequest(
			newGPTImage2EditContext(t, imageBytes, imageEditPNG(t, 32, 24, false)),
			relayconstant.RelayModeImagesEdits,
		)
		require.ErrorContains(t, err, "alpha channel")
	})

	t.Run("mask dimensions must match", func(t *testing.T) {
		_, err := GetAndValidOpenAIImageRequest(
			newGPTImage2EditContext(t, imageBytes, imageEditPNG(t, 24, 32, true)),
			relayconstant.RelayModeImagesEdits,
		)
		require.ErrorContains(t, err, "mask dimensions")
	})
}

func TestValidateGPTImage2SizeContract(t *testing.T) {
	tests := []struct {
		size    string
		wantErr string
	}{
		{size: "2240x3168"},
		{size: "4K"},
		{size: "1024x1024"},
		{size: "3072x4096", wantErr: "longest side"},
		{size: "1000x1000", wantErr: "multiples of 16"},
		{size: "512x512", wantErr: "below min"},
		{size: "3200x2400"},
		{size: "3200x800", wantErr: "3:1"},
	}
	for _, tt := range tests {
		t.Run(tt.size, func(t *testing.T) {
			err := ValidateGPTImage2Size(tt.size)
			if tt.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.ErrorContains(t, err, tt.wantErr)
		})
	}
}
