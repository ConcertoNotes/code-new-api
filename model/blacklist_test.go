package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupBlacklistModelTestDB(t *testing.T) {
	t.Helper()
	previousDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Option{}))
	DB = db
	t.Cleanup(func() { DB = previousDB })
}

func TestBlacklistOptionsUpdateAndPersist(t *testing.T) {
	setupBlacklistModelTestDB(t)
	common.OptionMap = map[string]string{}

	require.NoError(t, UpdateOption("BlacklistEmails", " USER@example.com\nuser@example.com "))
	require.True(t, common.IsBlacklistedEmail("user@example.com"))
	require.NoError(t, UpdateOption("BlacklistIPs", "192.0.2.1\n2001:db8::1"))
	require.True(t, common.IsBlacklistedIP("192.0.2.1"))

	var option Option
	require.NoError(t, DB.First(&option, "key = ?", "BlacklistIPs").Error)
	require.Equal(t, "192.0.2.1\n2001:db8::1", option.Value)

	require.Error(t, UpdateOption("BlacklistIPs", "not-an-ip"))
}

func TestAddBlacklistIPDeduplicatesAndPersists(t *testing.T) {
	setupBlacklistModelTestDB(t)
	common.OptionMap = map[string]string{}
	require.NoError(t, UpdateOption("BlacklistIPs", "192.0.2.1"))

	require.NoError(t, AddBlacklistIP(" 2001:0db8::1 "))
	require.NoError(t, AddBlacklistIP("2001:db8::1"))

	var option Option
	require.NoError(t, DB.First(&option, "key = ?", "BlacklistIPs").Error)
	require.Equal(t, "192.0.2.1\n2001:db8::1", option.Value)
	require.True(t, common.IsBlacklistedIP("2001:db8::1"))
}
