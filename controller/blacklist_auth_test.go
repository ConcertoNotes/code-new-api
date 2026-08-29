package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestMarkBlacklistedEmailIPPersistsRequestIP(t *testing.T) {
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	model.DB = db
	common.OptionMap = map[string]string{}
	common.SetBlacklistEmails([]string{"blocked@example.com"})
	common.SetBlacklistIPs(nil)
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetBlacklistEmails(nil)
		common.SetBlacklistIPs(nil)
	})

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/api/user/register", nil)
	ctx.Request.RemoteAddr = "192.0.2.50:1234"
	require.True(t, markBlacklistedEmailIP(ctx, "BLOCKED@example.com"))
	require.True(t, common.IsBlacklistedIP("192.0.2.50"))

	var option model.Option
	require.NoError(t, db.First(&option, "key = ?", "BlacklistIPs").Error)
	require.Equal(t, "192.0.2.50", option.Value)
}

func TestMarkBlacklistedEmailIPIgnoresAllowedEmail(t *testing.T) {
	common.SetBlacklistEmails([]string{"blocked@example.com"})
	common.SetBlacklistIPs(nil)
	t.Cleanup(func() {
		common.SetBlacklistEmails(nil)
		common.SetBlacklistIPs(nil)
	})
	require.False(t, markBlacklistedEmailIP(nil, "allowed@example.com"))
}
