package model

import (
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestGenerationPriceOptionsPersistence(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(":memory:")
			case "mysql":
				dsn := os.Getenv("TEST_MYSQL_DSN")
				if dsn == "" {
					t.Skip("TEST_MYSQL_DSN not configured")
				}
				driver = mysql.Open(dsn)
			case "postgres":
				dsn := os.Getenv("TEST_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("TEST_POSTGRES_DSN not configured")
				}
				driver = postgres.Open(dsn)
			}
			prefix := fmt.Sprintf("generation_%d_", time.Now().UnixNano())
			db, err := gorm.Open(driver, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: prefix}})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
			var version string
			versionQuery := "SELECT version()"
			if dialect == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
			t.Logf("database=%s version=%s", dialect, version)

			previousDB, previousOptions := DB, common.OptionMap
			previousVideo := ratio_setting.VideoGenerationPrice2JSONString()
			previousImage := ratio_setting.ImageGenerationPrice2JSONString()
			t.Cleanup(func() {
				DB, common.OptionMap = previousDB, previousOptions
				require.NoError(t, ratio_setting.UpdateVideoGenerationPriceByJSONString(previousVideo))
				require.NoError(t, ratio_setting.UpdateImageGenerationPriceByJSONString(previousImage))
			})
			DB = db
			common.OptionMap = map[string]string{}
			t.Cleanup(func() { require.NoError(t, db.Migrator().DropTable(&Option{})) })
			require.NoError(t, DB.AutoMigrate(&Option{}))
			const video = `{"seedance-2-0":{"720p":1,"1080p":2.2,"4k":4.3}}`
			const image = `{"gpt-image-2":{"1K":0.15,"2K":0.15,"4K":0.15}}`
			// These keys predate the update: reloading must restore their behavior
			// without changing their stored values or unrelated site settings.
			require.NoError(t, DB.Create(&[]Option{
				{Key: "VideoGenerationPrice", Value: video},
				{Key: "ImageGenerationPrice", Value: image},
				{Key: "restoration-test-unrelated", Value: "preserve"},
			}).Error)
			for range 2 {
				loadOptionsFromDatabase()
				p, ok := ratio_setting.GetVideoGenerationPrice("seedance-2-0", "1080p")
				assert.True(t, ok)
				assert.Equal(t, 2.2, p)
				p, ok = ratio_setting.GetImageGenerationPrice("gpt-image-2", "4K")
				assert.True(t, ok)
				assert.Equal(t, 0.15, p)
				assert.JSONEq(t, video, requireOptionValue(t, DB, "VideoGenerationPrice"))
			}
			require.Error(t, UpdateOption("VideoGenerationPrice", `{"seedance-2-0":{"720p":-1}}`))
			require.Error(t, UpdateOption("ImageGenerationPrice", `{"gpt-image-2":{"4K":-1}}`))
			assert.JSONEq(t, video, common.OptionMap["VideoGenerationPrice"])
			assert.JSONEq(t, image, requireOptionValue(t, DB, "ImageGenerationPrice"))
			const updated = `{"seedance-2-0":{"720p":0,"4k":10}}`
			require.NoError(t, UpdateOption("VideoGenerationPrice", updated))
			loadOptionsFromDatabase()
			assert.JSONEq(t, updated, ratio_setting.VideoGenerationPrice2JSONString())
			assert.JSONEq(t, updated, requireOptionValue(t, DB, "VideoGenerationPrice"))
			require.NoError(t, UpdateOptionsBulk(map[string]string{"VideoGenerationPrice": "{}", "ImageGenerationPrice": "{}"}))
			loadOptionsFromDatabase()
			assert.False(t, ratio_setting.HasVideoGenerationPrice("seedance-2-0"))
			assert.Equal(t, "preserve", requireOptionValue(t, DB, "restoration-test-unrelated"))

			// A failed storage write must not report success or mutate live prices.
			DB = db.Table(prefix + "missing").Session(&gorm.Session{})
			require.Error(t, UpdateOption("VideoGenerationPrice", video))
			assert.JSONEq(t, "{}", common.OptionMap["VideoGenerationPrice"])
		})
	}
}
