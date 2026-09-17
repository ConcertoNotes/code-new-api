package model

import (
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// 打开测试数据库；MySQL/PostgreSQL 仅在配置了 DSN 时运行，否则跳过
func openProfitTestDB(t *testing.T, dialect string) *gorm.DB {
	t.Helper()
	var driver gorm.Dialector
	var databaseType common.DatabaseType
	switch dialect {
	case "sqlite":
		driver = sqlite.Open(":memory:")
		databaseType = common.DatabaseTypeSQLite
	case "mysql":
		dsn := os.Getenv("TEST_MYSQL_DSN")
		if dsn == "" {
			t.Skip("TEST_MYSQL_DSN not configured")
		}
		driver = mysql.Open(dsn)
		databaseType = common.DatabaseTypeMySQL
	case "postgres":
		dsn := os.Getenv("TEST_POSTGRES_DSN")
		if dsn == "" {
			t.Skip("TEST_POSTGRES_DSN not configured")
		}
		driver = postgres.Open(dsn)
		databaseType = common.DatabaseTypePostgreSQL
	}
	prefix := fmt.Sprintf("profit_%d_", time.Now().UnixNano())
	db, err := gorm.Open(driver, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: prefix}})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	previousDB, previousLogDB := DB, LOG_DB
	previousMainType, previousLogType := common.MainDatabaseType(), common.LogDatabaseType()
	common.SetDatabaseTypes(databaseType, databaseType)
	initCol()
	DB, LOG_DB = db, db
	require.NoError(t, db.AutoMigrate(&Log{}, &Channel{}))
	t.Cleanup(func() {
		require.NoError(t, db.Migrator().DropTable(&Log{}, &Channel{}))
		DB, LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMainType, previousLogType)
		initCol()
		require.NoError(t, sqlDB.Close())
	})
	return db
}

func TestChannelProfitUsageStats(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			db := openProfitTestDB(t, dialect)

			// 三种 other 形态：记录了 official_quota、仅记录 group_ratio、完全没有元数据
			const day = int64(86400)
			base := int64(1_700_000_000)
			base -= base % day
			require.NoError(t, db.Create(&[]Log{
				{Type: LogTypeConsume, ChannelId: 1, Group: "default", Quota: 1500, CreatedAt: base + 100, Other: `{"official_quota":1000,"group_ratio":1.5}`},
				{Type: LogTypeConsume, ChannelId: 1, Group: "default", Quota: 3000, CreatedAt: base + 200, Other: `{"group_ratio":1.5}`},
				{Type: LogTypeConsume, ChannelId: 1, Group: "vip", Quota: 400, CreatedAt: base + day + 50, Other: ``},
				{Type: LogTypeConsume, ChannelId: 2, Group: "default", Quota: 800, CreatedAt: base + day + 60, Other: `{"official_quota":600}`},
				// 非消费类型与范围外的记录必须被排除
				{Type: LogTypeTopup, ChannelId: 1, Group: "default", Quota: 99999, CreatedAt: base + 300, Other: ``},
				{Type: LogTypeConsume, ChannelId: 1, Group: "default", Quota: 77777, CreatedAt: base + 5*day, Other: ``},
			}).Error)

			stats, err := GetChannelGroupUsageStats(base, base+2*day-1)
			require.NoError(t, err)
			byKey := make(map[string]ChannelGroupUsageStat, len(stats))
			for _, stat := range stats {
				byKey[fmt.Sprintf("%d|%s", stat.ChannelId, stat.UseGroup)] = stat
			}
			require.Len(t, byKey, 3)

			assert.EqualValues(t, 2, byKey["1|default"].Requests)
			assert.EqualValues(t, 4500, byKey["1|default"].Quota)
			// 1000（直接记录）+ 3000/1.5（按分组倍率反推）
			assert.InDelta(t, 3000, byKey["1|default"].OfficialQuota, 0.001)
			assert.EqualValues(t, base+200, byKey["1|default"].LastUsedAt)

			assert.EqualValues(t, 1, byKey["1|vip"].Requests)
			assert.EqualValues(t, 400, byKey["1|vip"].Quota)
			// 没有任何元数据时官方价回退为 quota 本身
			assert.InDelta(t, 400, byKey["1|vip"].OfficialQuota, 0.001)

			assert.EqualValues(t, 800, byKey["2|default"].Quota)
			assert.InDelta(t, 600, byKey["2|default"].OfficialQuota, 0.001)

			daily, err := GetChannelDailyUsageStats(base, base+2*day-1, 0)
			require.NoError(t, err)
			require.Len(t, daily, 3)
			assert.Equal(t, ChannelDailyUsageStat{Bucket: base, ChannelId: 1, Quota: 4500, OfficialQuota: 3000}, daily[0])
			assert.Equal(t, base+day, daily[1].Bucket)
			assert.Equal(t, base+day, daily[2].Bucket)

			// 东八区：第 0 天 base+100 落在本地当天，桶起点仍是本地零点对应的 UTC 时间戳
			shifted, err := GetChannelDailyUsageStats(base, base+2*day-1, 8*3600)
			require.NoError(t, err)
			require.NotEmpty(t, shifted)
			assert.Equal(t, base-8*3600, shifted[0].Bucket)

			_, err = GetChannelDailyUsageStats(base, base+day, 15*3600)
			assert.Error(t, err)
		})
	}
}

func TestGetProfitChannelBriefsTrimsGroups(t *testing.T) {
	db := openProfitTestDB(t, "sqlite")
	require.NoError(t, db.Create(&[]Channel{
		{Name: "openai", Type: 1, Status: common.ChannelStatusEnabled, Group: " default, vip "},
		{Name: "claude", Type: 14, Status: common.ChannelStatusManuallyDisabled, Group: "svip"},
	}).Error)

	briefs, err := GetProfitChannelBriefs()
	require.NoError(t, err)
	require.Len(t, briefs, 2)
	assert.Equal(t, "default, vip", briefs[0].Group)
	assert.Equal(t, common.ChannelStatusEnabled, briefs[0].Status)
	assert.Equal(t, "svip", briefs[1].Group)
	assert.Equal(t, common.ChannelStatusManuallyDisabled, briefs[1].Status)
}
