package model

import (
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

// openQualityTestDB 打开带独立表前缀的测试库；MySQL/PostgreSQL 仅在配置 DSN 时运行
func openQualityTestDB(t *testing.T, dialect string) *gorm.DB {
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
	prefix := fmt.Sprintf("qt_%d_", time.Now().UnixNano())
	db, err := gorm.Open(driver, &gorm.Config{
		NamingStrategy: schema.NamingStrategy{TablePrefix: prefix},
		Logger:         logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	previousDB, previousLogDB := DB, LOG_DB
	previousMainType, previousLogType := common.MainDatabaseType(), common.LogDatabaseType()
	common.SetDatabaseTypes(databaseType, databaseType)
	initCol()
	DB, LOG_DB = db, db
	// 迁移执行两次，证明重复启动时幂等
	for i := 0; i < 2; i++ {
		require.NoError(t, db.AutoMigrate(&QualityTestJob{}, &QualityTestPrompt{}, &Channel{}))
	}
	t.Cleanup(func() {
		require.NoError(t, db.Migrator().DropTable(&QualityTestJob{}, &QualityTestPrompt{}, &Channel{}))
		DB, LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMainType, previousLogType)
		initCol()
		require.NoError(t, sqlDB.Close())
	})
	return db
}

func TestQualityTestJobAdmissionOnDatabases(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			db := openQualityTestDB(t, dialect)

			first := &QualityTestJob{ChannelId: 1, ChannelName: "a", ChannelGroup: "default", Model: "gpt-5", Prompt: "p"}
			require.NoError(t, CreateQualityTestJob(first))
			assert.Equal(t, QualityTestStatusRunning, first.Status)

			busy := &QualityTestJob{ChannelId: 1, ChannelGroup: "default", Model: "gpt-5", Prompt: "p"}
			assert.ErrorIs(t, CreateQualityTestJob(busy), ErrQualityTestChannelBusy, "同一渠道同时只能有一个任务")

			require.NoError(t, CreateQualityTestJob(&QualityTestJob{ChannelId: 2, ChannelGroup: "default", Model: "gpt-5", Prompt: "p"}))
			require.NoError(t, CreateQualityTestJob(&QualityTestJob{ChannelId: 3, ChannelGroup: "vip", Model: "gpt-5", Prompt: "p"}))
			assert.ErrorIs(t, CreateQualityTestJob(&QualityTestJob{ChannelId: 4, ChannelGroup: "vip", Model: "gpt-5", Prompt: "p"}), ErrQualityTestCapacity)

			// 失去心跳的任务被判定为中断，释放名额
			stale := time.Now().Add(-2 * qualityTestStaleAfter).Unix()
			require.NoError(t, db.Model(&QualityTestJob{}).Where("id = ?", first.Id).Update("updated_at", stale).Error)
			require.NoError(t, CreateQualityTestJob(&QualityTestJob{ChannelId: 4, ChannelGroup: "vip", Model: "gpt-5", Prompt: "p"}))
			interrupted, err := GetQualityTestJob(first.Id)
			require.NoError(t, err)
			assert.Equal(t, QualityTestStatusInterrupted, interrupted.Status)
			assert.NotZero(t, interrupted.CompletedAt)
		})
	}
}

func TestQualityTestJobLifecycleOnDatabases(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			openQualityTestDB(t, dialect)

			job := &QualityTestJob{ChannelId: 7, ChannelName: "codex-1", ChannelGroup: "vip", Model: "gpt-5", ReasoningEffort: "high", Prompt: "draw", PresetKind: "builtin", PresetRef: "pelican", PresetName: "Pelican"}
			require.NoError(t, CreateQualityTestJob(job))

			// 输出超过 64 KiB，确认 MySQL 上不是 TEXT 列
			job.Output = strings.Repeat("<svg></svg>", 30000)
			job.OutputTokens = func(v int) *int { return &v }(1234)
			require.NoError(t, SaveQualityTestProgress(job))

			require.NoError(t, CancelQualityTest(job.Id))
			status, err := GetQualityTestStatus(job.Id)
			require.NoError(t, err)
			assert.Equal(t, QualityTestStatusCancelling, status)

			// 已结束的任务不能再被运行中的进度写入覆盖
			job.Status = QualityTestStatusStopped
			require.NoError(t, FinishQualityTest(job))
			job.Output = "late"
			require.NoError(t, SaveQualityTestProgress(job))
			saved, err := GetQualityTestJob(job.Id)
			require.NoError(t, err)
			assert.Equal(t, QualityTestStatusStopped, saved.Status)
			assert.Len(t, saved.Output, 30000*len("<svg></svg>"))
			require.NotNil(t, saved.OutputTokens)
			assert.Equal(t, 1234, *saved.OutputTokens)

			require.NoError(t, CreateQualityTestJob(&QualityTestJob{ChannelId: 8, ChannelName: "claude", ChannelGroup: "default", Model: "claude-opus", Prompt: "hand typed"}))

			page, err := ListQualityTests(1, 20, QualityTestFilter{})
			require.NoError(t, err)
			assert.EqualValues(t, 2, page.Total)
			require.Len(t, page.ActiveJobs, 1)
			assert.Equal(t, 8, page.ActiveJobs[0].ChannelId)
			assert.Empty(t, page.Jobs[0].Output, "列表不返回输出正文")
			assert.Equal(t, []string{"default", "vip"}, page.Facets.Groups)
			assert.Equal(t, []string{"", "high"}, page.Facets.Efforts)
			assert.Equal(t, []QualityTestChannelFacet{{Id: 7, Name: "codex-1"}, {Id: 8, Name: "claude"}}, page.Facets.Channels)
			assert.Equal(t, []QualityTestPresetFacet{{Kind: "builtin", Ref: "pelican", Name: "Pelican"}}, page.Facets.Presets)

			defaultEffort, err := ListQualityTests(1, 20, QualityTestFilter{HasEffort: true})
			require.NoError(t, err)
			require.Len(t, defaultEffort.Jobs, 1)
			assert.Equal(t, 8, defaultEffort.Jobs[0].ChannelId)

			handTyped, err := ListQualityTests(1, 20, QualityTestFilter{HasPreset: true})
			require.NoError(t, err)
			require.Len(t, handTyped.Jobs, 1)
			assert.Equal(t, 8, handTyped.Jobs[0].ChannelId)

			byPreset, err := ListQualityTests(1, 20, QualityTestFilter{HasPreset: true, PresetKind: "builtin", PresetRef: "pelican", Group: "vip"})
			require.NoError(t, err)
			require.Len(t, byPreset.Jobs, 1)
			assert.Equal(t, 7, byPreset.Jobs[0].ChannelId)
		})
	}
}

func TestQualityTestPromptsOnDatabases(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			openQualityTestDB(t, dialect)

			prompt := &QualityTestPrompt{Name: "clock", Prompt: "draw a clock"}
			require.NoError(t, CreateQualityTestPrompt(prompt))
			require.NoError(t, IncrementQualityTestPromptUsage(prompt.Id))
			require.NoError(t, IncrementQualityTestPromptUsage(prompt.Id))
			require.NoError(t, UpdateQualityTestPrompt(prompt.Id, "clock v2", "draw a better clock"))

			prompts, err := ListQualityTestPrompts()
			require.NoError(t, err)
			require.Len(t, prompts, 1)
			assert.Equal(t, "clock v2", prompts[0].Name)
			assert.Equal(t, "draw a better clock", prompts[0].Prompt)
			assert.Equal(t, 2, prompts[0].UsageCount)
			assert.NotZero(t, prompts[0].LastUsedAt)

			require.NoError(t, DeleteQualityTestPrompt(prompt.Id))
			_, err = GetQualityTestPrompt(prompt.Id)
			assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
		})
	}
}

func TestGetQualityTestChannelsReadsGroupColumnOnDatabases(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			db := openQualityTestDB(t, dialect)
			require.NoError(t, db.Create(&Channel{Name: "c1", Type: 1, Key: "k", Group: "default,vip", Models: "gpt-5,gpt-5-mini", Status: 1}).Error)

			channels, err := GetQualityTestChannels()
			require.NoError(t, err)
			require.Len(t, channels, 1)
			assert.Equal(t, []string{"default", "vip"}, channels[0].GetGroups())
			assert.Equal(t, []string{"gpt-5", "gpt-5-mini"}, channels[0].GetModels())
			assert.Empty(t, channels[0].Key, "选项查询不读取渠道密钥")
		})
	}
}
