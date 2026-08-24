package middleware

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http/httptest"
	"strings"
	"testing"

	relayhelper "github.com/QuantumNous/new-api/relay/helper"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetModelFromJSONBodyReadsImageSizeAndPreservesBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	body := `{"model":"image-model","size":"1536x1024","resolution":"4K","aspect_ratio":"16:9","prompt":"draw"}`
	c.Request = httptest.NewRequest("POST", "/v1/images/generations", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	request, err := getModelFromJSONBody(c)
	require.NoError(t, err)
	assert.Equal(t, "image-model", request.Model)
	assert.Equal(t, "1536x1024", request.Size)
	assert.Equal(t, "4K", request.Resolution)
	assert.Equal(t, "16:9", request.AspectRatio)
	assert.Equal(t, "draw", request.Prompt)

	replayed, err := io.ReadAll(c.Request.Body)
	require.NoError(t, err)
	assert.JSONEq(t, body, string(replayed))
}

func TestGetModelFromJSONBodyReadsPromptSizeForGatewayRouting(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	body := `{"model":"gpt-image-2","prompt":"生成一张樱花照片，大小为2240x3168","size":"1024x1024"}`
	c.Request = httptest.NewRequest("POST", "/v1/images/generations", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	request, err := getModelFromJSONBody(c)
	require.NoError(t, err)
	assert.Equal(t, "1024x1024", request.Size)
	assert.Equal(t, "生成一张樱花照片，大小为2240x3168", request.Prompt)
	assert.Equal(t, "2240x3168", relayhelper.ResolveImageRequestSize(request.Size, request.Prompt))
}

func TestGetModelFromRequestReadsMultipartImageOptions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "image-model"))
	require.NoError(t, writer.WriteField("size", "2240x3168"))
	require.NoError(t, writer.WriteField("resolution", "2K"))
	require.NoError(t, writer.WriteField("aspect_ratio", "3:4"))
	require.NoError(t, writer.Close())

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())

	request, err := getModelFromRequest(c)
	require.NoError(t, err)
	assert.Equal(t, "image-model", request.Model)
	assert.Equal(t, "2240x3168", request.Size)
	assert.Equal(t, "2K", request.Resolution)
	assert.Equal(t, "3:4", request.AspectRatio)
}

func TestGetModelRequestDetectsMultipartImageMask(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "gpt-image-2"))
	require.NoError(t, writer.WriteField("prompt", "edit the selected area"))
	imagePart, err := writer.CreateFormFile("image", "image.png")
	require.NoError(t, err)
	_, err = imagePart.Write([]byte("image"))
	require.NoError(t, err)
	maskPart, err := writer.CreateFormFile("mask", "mask.png")
	require.NoError(t, err)
	_, err = maskPart.Write([]byte("mask"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())

	request, shouldSelect, err := getModelRequest(c)
	require.NoError(t, err)
	assert.True(t, shouldSelect)
	assert.True(t, request.HasMask)
	assert.Equal(t, "gpt-image-2", request.Model)
}
