package middleware

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	appI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	relayhelper "github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func newDisabledAffinityDistributorContext(affinityKey string) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(`{"model":"gpt-5"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Request.Header.Set("X-Test-Affinity", affinityKey)
	common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
	common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
	return c, recorder
}

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

func TestDistributeClearsDisabledAffinityBeforeStoppingRetry(t *testing.T) {
	gin.SetMode(gin.TestMode)
	require.NoError(t, appI18n.Init())

	previousDB := model.DB
	previousMemoryCache := common.MemoryCacheEnabled
	previousRedisEnabled := common.RedisEnabled
	setting := operation_setting.GetChannelAffinitySetting()
	require.NotNil(t, setting)
	previousSetting := *setting

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))
	model.DB = db
	common.MemoryCacheEnabled = true
	common.RedisEnabled = false
	*setting = operation_setting.ChannelAffinitySetting{
		Enabled:               true,
		SwitchOnSuccess:       true,
		KeepOnChannelDisabled: false,
		MaxEntries:            100_000,
		DefaultTTLSeconds:     3600,
		Rules: []operation_setting.ChannelAffinityRule{
			{
				Name:       "disabled-affinity-test",
				ModelRegex: []string{"^gpt-.*$"},
				PathRegex:  []string{"/v1/responses"},
				KeySources: []operation_setting.ChannelAffinityKeySource{
					{Type: "request_header", Key: "X-Test-Affinity"},
				},
				SkipRetryOnFailure: true,
				IncludeUsingGroup:  true,
				IncludeModelName:   true,
				IncludeRuleName:    true,
			},
		},
	}
	t.Cleanup(func() {
		*setting = previousSetting
		model.DB = previousDB
		common.MemoryCacheEnabled = previousMemoryCache
		common.RedisEnabled = previousRedisEnabled
		if previousDB != nil {
			model.InitChannelCache()
		}
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})

	disabledChannel := model.Channel{
		Id:     9527,
		Name:   "disabled-affinity",
		Key:    "sk-disabled",
		Status: common.ChannelStatusManuallyDisabled,
		Group:  "default",
		Models: "gpt-5",
	}
	require.NoError(t, db.Create(&disabledChannel).Error)
	model.InitChannelCache()

	affinityKey := "disabled-channel-binding"
	seedContext, _ := newDisabledAffinityDistributorContext(affinityKey)
	_, found := service.GetPreferredChannelByAffinity(seedContext, "gpt-5", "default")
	require.False(t, found)
	service.RecordChannelAffinity(seedContext, disabledChannel.Id)

	requestContext, recorder := newDisabledAffinityDistributorContext(affinityKey)
	Distribute()(requestContext)
	require.Equal(t, http.StatusServiceUnavailable, recorder.Code)

	probeContext, _ := newDisabledAffinityDistributorContext(affinityKey)
	_, found = service.GetPreferredChannelByAffinity(probeContext, "gpt-5", "default")
	require.False(t, found, "disabled affinity must be cleared before retry is stopped")
}
