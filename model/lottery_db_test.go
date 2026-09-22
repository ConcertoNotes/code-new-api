package model

import (
	"errors"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// legacyLotteryDraw 是 5316641f 版本发布时的 lottery_draws 表结构，用于验证升级迁移保留旧数据
type legacyLotteryDraw struct {
	Id        int     `json:"id"`
	UserId    int     `json:"user_id" gorm:"index"`
	Amount    float64 `json:"amount"`
	CreatedAt int64   `json:"created_at" gorm:"index"`
}

func (legacyLotteryDraw) TableName() string { return "lottery_draws" }

// TestLotteryOnRealDatabases 在真实 MySQL / PostgreSQL 上验证：迁移幂等、旧表升级保留数据、
// 并发抽奖不会双抽或把库存扣成负数、入账金额与中奖记录严格一致。
// 需要 TEST_MYSQL_DSN / TEST_POSTGRES_DSN，未配置时跳过。
func TestLotteryOnRealDatabases(t *testing.T) {
	for _, dialect := range []string{"mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var dsn string
			var dial gorm.Dialector
			var dbType common.DatabaseType
			switch dialect {
			case "mysql":
				dsn = strings.TrimSpace(os.Getenv("TEST_MYSQL_DSN"))
				dial = mysql.Open(dsn)
				dbType = common.DatabaseTypeMySQL
			default:
				dsn = strings.TrimSpace(os.Getenv("TEST_POSTGRES_DSN"))
				dial = postgres.Open(dsn)
				dbType = common.DatabaseTypePostgreSQL
			}
			if dsn == "" {
				t.Skip("DSN not configured")
			}
			db, err := gorm.Open(dial, &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
			require.NoError(t, err)

			savedDB, savedLogDB := DB, LOG_DB
			DB, LOG_DB = db, db
			common.SetDatabaseTypes(dbType, dbType)
			t.Cleanup(func() {
				DB, LOG_DB = savedDB, savedLogDB
				common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
			})

			tables := []string{"lottery_draws", "lottery_prizes", "lottery_accounts", "top_ups", "logs", "quota_data", "users"}
			for _, table := range tables {
				require.NoError(t, db.Migrator().DropTable(table))
			}

			// 升级路径：先建旧版表并写入一条旧记录，再跑两次 AutoMigrate 证明幂等且数据保留
			require.NoError(t, db.AutoMigrate(&legacyLotteryDraw{}))
			require.NoError(t, db.Create(&legacyLotteryDraw{UserId: 42, Amount: 1, CreatedAt: 1}).Error)
			for i := 0; i < 2; i++ {
				require.NoError(t, db.AutoMigrate(&User{}, &TopUp{}, &Log{}, &QuotaData{}, &LotteryPrize{}, &LotteryDraw{}, &LotteryAccount{}))
			}
			var legacy LotteryDraw
			require.NoError(t, db.Where("user_id = ?", 42).First(&legacy).Error)
			assert.InDelta(t, 1, legacy.Amount, 1e-9)
			assert.Equal(t, 0, legacy.Quota, "旧记录新列取零值")
			assert.True(t, db.Migrator().HasIndex(&LotteryAccount{}, "UserId") || db.Migrator().HasIndex(&LotteryAccount{}, "idx_lottery_accounts_user_id"))
			require.NoError(t, db.Where("user_id = ?", 42).Delete(&LotteryDraw{}).Error)

			withLotteryActivity(t, 1, 0)
			now := common.GetTimestamp()

			// 场景 1：同一用户只有 1 次机会，20 个并发请求只能成功 1 次
			solo := User{Username: "lottery-solo-" + dialect, Quota: 0, AffCode: "solo" + dialect[:2]}
			require.NoError(t, db.Create(&solo).Error)
			seedLotteryTopUp(t, solo.Id, 20, now-60, PaymentProviderEpay, common.TopUpStatusSuccess)
			_, err = GetLotteryStatus(solo.Id)
			require.NoError(t, err)

			var wg sync.WaitGroup
			var mu sync.Mutex
			successes := 0
			credited := 0
			for i := 0; i < 20; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					r, err := DrawLottery(solo.Id, false)
					if err != nil {
						return
					}
					mu.Lock()
					successes++
					credited += r.Quota
					mu.Unlock()
				}()
			}
			wg.Wait()
			assert.Equal(t, 1, successes, "同一用户并发只能抽中一次")
			var refreshed User
			require.NoError(t, db.First(&refreshed, solo.Id).Error)
			assert.Equal(t, credited, refreshed.Quota, "入账金额必须等于中奖记录金额")
			var account LotteryAccount
			require.NoError(t, db.Where("user_id = ?", solo.Id).First(&account).Error)
			assert.Equal(t, 1, account.DrawsUsed)

			// 场景 2：奖池只剩 3 张券，30 个不同用户并发抽，只有 3 人成功且库存不为负、总入账 = 总中奖
			require.NoError(t, db.Session(&gorm.Session{AllowGlobalUpdate: true}).Model(&LotteryPrize{}).UpdateColumn("stock", 0).Error)
			require.NoError(t, db.Model(&LotteryPrize{}).Where("amount = ?", 1).UpdateColumn("stock", 3).Error)
			users := make([]User, 0, 30)
			for i := 0; i < 30; i++ {
				u := User{Username: "lottery-crowd-" + dialect + "-" + common.GetRandomString(4), Quota: 10, AffCode: common.GetRandomString(6)}
				require.NoError(t, db.Create(&u).Error)
				seedLotteryTopUp(t, u.Id, 20, now-60, PaymentProviderEpay, common.TopUpStatusSuccess)
				users = append(users, u)
			}
			successes, credited = 0, 0
			wonAmount := 0.0
			unexpected := 0
			for _, u := range users {
				wg.Add(1)
				go func(id int) {
					defer wg.Done()
					r, err := DrawLottery(id, false)
					if err != nil {
						if !errors.Is(err, ErrLotteryPoolExhausted) {
							t.Logf("unexpected draw error: %v", err)
							mu.Lock()
							unexpected++
							mu.Unlock()
						}
						return
					}
					mu.Lock()
					successes++
					credited += r.Quota
					wonAmount += r.Amount
					mu.Unlock()
				}(u.Id)
			}
			wg.Wait()
			assert.Equal(t, 3, successes, "库存 3 张只能有 3 人中奖")
			assert.Equal(t, 0, unexpected, "落选者只能收到奖池售罄错误，不能出现死锁或其他数据库错误")
			var minStock int
			require.NoError(t, db.Model(&LotteryPrize{}).Select("MIN(stock)").Scan(&minStock).Error)
			assert.GreaterOrEqual(t, minStock, 0, "库存不能为负")
			var totalQuota int64
			require.NoError(t, db.Model(&User{}).Where("username LIKE ?", "lottery-crowd-"+dialect+"-%").Select("SUM(quota) - 10 * COUNT(*)").Scan(&totalQuota).Error)
			assert.Equal(t, int64(credited), totalQuota, "所有用户新增余额之和必须等于发放总额")
			var draws []LotteryDraw
			require.NoError(t, db.Where("user_id <> ?", solo.Id).Find(&draws).Error)
			require.Len(t, draws, 3)
			sumQuota := 0
			for _, d := range draws {
				sumQuota += d.Quota
				assert.NotEmpty(t, d.StockSnapshot)
			}
			assert.Equal(t, credited, sumQuota)
			assert.InDelta(t, 3, wonAmount, 1e-9)

			// 管理员监控聚合在真实数据库上的 GROUP BY / DISTINCT 语法必须可用
			overview, err := GetLotteryAdminOverview(50)
			require.NoError(t, err)
			assert.Equal(t, int64(4), overview.DrawCount)
			assert.Equal(t, int64(4), overview.WinnerCount)
			require.Len(t, overview.Winners, 4)
			for _, w := range overview.Winners {
				assert.NotEmpty(t, w.Username)
				assert.Equal(t, int64(1), w.Draws)
			}
			page, total, err := GetLotteryDrawsForAdmin("lottery-crowd", 0, 2)
			require.NoError(t, err)
			assert.Equal(t, int64(3), total)
			assert.Len(t, page, 2)
		})
	}
}
