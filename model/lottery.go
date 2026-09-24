package model

import (
	"errors"
	"fmt"
	"math"
	"math/rand"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// LotteryPrize 奖池中的一档奖励，Amount 为额度（美元单位），Stock 为剩余奖券数
type LotteryPrize struct {
	Id           int     `json:"id"`
	Amount       float64 `json:"amount"`
	Stock        int     `json:"stock"`
	InitialStock int     `json:"initial_stock"`
}

// LotteryAccount 每个用户一行，DrawsUsed 是已消耗的抽奖次数，抽奖时用 CAS 更新防止并发双抽
type LotteryAccount struct {
	Id        int `json:"id"`
	UserId    int `json:"user_id" gorm:"uniqueIndex"`
	DrawsUsed int `json:"draws_used"`
}

// LotteryDraw 一次抽奖的审计记录：中奖额度、实际入账 quota、抽取时的系数和库存快照
type LotteryDraw struct {
	Id            int     `json:"id"`
	UserId        int     `json:"user_id" gorm:"index"`
	Amount        float64 `json:"amount"`
	Quota         int     `json:"quota"`
	UserFactor    float64 `json:"user_factor"`
	BudgetFactor  float64 `json:"budget_factor"`
	StockSnapshot string  `json:"stock_snapshot" gorm:"type:varchar(255)"`
	CreatedAt     int64   `json:"created_at" gorm:"index"`
}

// LotteryStatusInfo 活动状态接口需要的聚合数据
type LotteryStatusInfo struct {
	Recharge        float64
	DrawsUsed       int
	DrawsAvailable  int
	NextThreshold   float64
	TotalReward     float64
	Prizes          []LotteryPrize
	BudgetRemaining float64
	Refilling       bool
}

var (
	ErrLotteryInactive      = errors.New("lottery inactive")
	ErrLotteryNoDraws       = errors.New("lottery draw unavailable")
	ErrLotteryPoolExhausted = errors.New("lottery pool exhausted")
	ErrLotteryRefilling     = errors.New("lottery pool refilling")
	ErrLotteryRetry         = errors.New("lottery draw conflict, please retry")
)

// 首池配置：135 张奖券，合计 260 额度（1×80 + 2×40 + 5×10 + 10×5）
var lotteryPrizes = []struct {
	amount float64
	stock  int
}{{1, 80}, {2, 40}, {5, 10}, {10, 5}}

// 大奖档位阈值：达到该额度的奖项受预算系数与用户系数约束
const lotteryBigPrizeAmount = 5

// ensureLotteryPrizes 首次访问时按配置建池。若库里的档位与配置不一致且还没有任何抽奖记录
// （例如活动上线前调整了奖项），则按新配置重建；已有抽奖记录时不动库存，避免破坏审计一致性。
func ensureLotteryPrizes(tx *gorm.DB) error {
	var existing []LotteryPrize
	if err := tx.Order("amount").Find(&existing).Error; err != nil {
		return err
	}
	if len(existing) > 0 {
		matches := len(existing) == len(lotteryPrizes)
		for i := 0; matches && i < len(existing); i++ {
			matches = existing[i].Amount == lotteryPrizes[i].amount && existing[i].InitialStock == lotteryPrizes[i].stock
		}
		if matches {
			return nil
		}
		var draws int64
		if err := tx.Model(&LotteryDraw{}).Count(&draws).Error; err != nil {
			return err
		}
		if draws > 0 {
			common.SysLog("lottery prize table differs from configured tiers but draws exist; keeping existing pool")
			return nil
		}
		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&LotteryPrize{}).Error; err != nil {
			return err
		}
	}
	for _, p := range lotteryPrizes {
		if err := tx.Create(&LotteryPrize{Amount: p.amount, Stock: p.stock, InitialStock: p.stock}).Error; err != nil {
			return err
		}
	}
	return nil
}

// lotteryRechargeMoney 统计活动窗口内成功的真实付款金额；userId 为 0 时统计全站。
// 余额购买订阅（payment_provider/payment_method = balance）不是新充值，不计入。
func lotteryRechargeMoney(tx *gorm.DB, userId int, s *operation_setting.LotterySetting) (float64, error) {
	query := tx.Model(&TopUp{}).
		Where("status = ? AND complete_time >= ? AND complete_time < ?", common.TopUpStatusSuccess, s.StartTime, s.EndTime).
		Where("payment_provider <> ? AND payment_method <> ?", PaymentProviderBalance, PaymentMethodBalance)
	if userId > 0 {
		query = query.Where("user_id = ?", userId)
	}
	var total float64
	err := query.Select("COALESCE(SUM(money), 0)").Scan(&total).Error
	return total, err
}

func lotteryIssuedAmount(tx *gorm.DB, userId int) (float64, error) {
	query := tx.Model(&LotteryDraw{})
	if userId > 0 {
		query = query.Where("user_id = ?", userId)
	}
	var total float64
	err := query.Select("COALESCE(SUM(amount), 0)").Scan(&total).Error
	return total, err
}

// lotteryAllowedDraws 按累计充值金额换算可获得的总抽奖次数
func lotteryAllowedDraws(recharge float64, threshold float64) int {
	if recharge <= 0 || threshold <= 0 {
		return 0
	}
	draws := recharge / threshold
	if draws > 1_000_000 {
		return 1_000_000
	}
	return int(draws)
}

// lotteryBudgetRemaining 计算当前还能发放的额度：活动累计充值（换算为额度）× 回馈比例 − 安全储备 − 已发放
func lotteryBudgetRemaining(tx *gorm.DB, s *operation_setting.LotterySetting) (float64, error) {
	rechargeAll, err := lotteryRechargeMoney(tx, 0, s)
	if err != nil {
		return 0, err
	}
	issued, err := lotteryIssuedAmount(tx, 0)
	if err != nil {
		return 0, err
	}
	price := operation_setting.Price
	if price <= 0 {
		price = 1
	}
	ratio := s.PayoutRatio
	if ratio < 0 {
		ratio = 0
	}
	return rechargeAll/price*ratio - s.ReserveQuota - issued, nil
}

// lotteryUserFactor 用户系数：充值越多、近期真实使用越充分、活跃天数越多，大奖权重越高
func lotteryUserFactor(recharge, usageQuotaUnits float64, activeDays int) float64 {
	clamp := func(v float64) float64 {
		if v > 1 {
			return 1
		}
		if v < 0 {
			return 0
		}
		return v
	}
	rechargeScore := clamp(recharge / 200)
	usageScore := 0.0
	if recharge > 0 {
		usageScore = clamp(usageQuotaUnits / recharge)
	}
	returnScore := clamp(float64(activeDays) / 14)
	return .5 + .25*rechargeScore + .15*usageScore + .1*returnScore
}

// lotteryPrizeWeights 计算每档奖项的抽取权重。
// 硬约束：奖项额度不能超过剩余预算；软约束：预算系数不足时优先只发小奖、大奖降权。
func lotteryPrizeWeights(prizes []LotteryPrize, userFactor, budgetFactor, budgetRemaining float64) []float64 {
	weights := make([]float64, len(prizes))
	hasSmall := false
	for _, p := range prizes {
		if p.Stock > 0 && p.Amount < lotteryBigPrizeAmount && p.Amount <= budgetRemaining {
			hasSmall = true
			break
		}
	}
	for i, p := range prizes {
		if p.Stock <= 0 || p.Amount > budgetRemaining {
			continue
		}
		w := float64(p.Stock)
		if p.Amount >= lotteryBigPrizeAmount {
			if budgetFactor < 1 && hasSmall {
				continue
			}
			if budgetFactor < 1.5 {
				w *= .7
			}
			if p.Amount >= 10 {
				w *= .55 + .45*userFactor
			} else {
				w *= .75 + .25*userFactor
			}
		}
		weights[i] = w
	}
	return weights
}

// pickLotteryPrize 按权重选择下标，r 为 [0,1) 的随机数；无可选项返回 -1
func pickLotteryPrize(weights []float64, r float64) int {
	sum := 0.0
	for _, w := range weights {
		sum += w
	}
	if sum <= 0 {
		return -1
	}
	pick := r * sum
	last := -1
	for i, w := range weights {
		if w <= 0 {
			continue
		}
		last = i
		pick -= w
		if pick < 0 {
			return i
		}
	}
	return last
}

func lotteryUsageStats(tx *gorm.DB, userId int, since int64) (usageQuotaUnits float64, activeDays int, err error) {
	var usedQuota int64
	if err = tx.Model(&QuotaData{}).Where("user_id = ? AND created_at >= ?", userId, since).
		Select("COALESCE(SUM(quota), 0)").Scan(&usedQuota).Error; err != nil {
		return 0, 0, err
	}
	var days int64
	if err = tx.Model(&QuotaData{}).Where("user_id = ? AND created_at >= ?", userId, since).
		Select("COUNT(DISTINCT (created_at - created_at % 86400))").Scan(&days).Error; err != nil {
		return 0, 0, err
	}
	return float64(usedQuota) / common.QuotaPerUnit, int(days), nil
}

func lotteryStockSnapshot(prizes []LotteryPrize) string {
	snapshot := ""
	for i, p := range prizes {
		if i > 0 {
			snapshot += ","
		}
		snapshot += fmt.Sprintf("%g:%d", p.Amount, p.Stock)
	}
	return snapshot
}

func lotteryPoolCost(prizes []LotteryPrize) float64 {
	cost := 0.0
	for _, p := range prizes {
		if p.Stock > 0 {
			cost += p.Amount * float64(p.Stock)
		}
	}
	return cost
}

// PreviewLottery 管理员预览：用真实库存和用户系数跑一次加权抽取，但忽略预算、
// 不扣库存、不入账、不写记录，只用于查看效果。
func PreviewLottery(userId int) (LotteryDraw, error) {
	if !operation_setting.GetLotterySetting().Enabled {
		return LotteryDraw{}, ErrLotteryInactive
	}
	if err := ensureLotteryPrizes(DB); err != nil {
		return LotteryDraw{}, err
	}
	var prizes []LotteryPrize
	if err := DB.Order("amount").Find(&prizes).Error; err != nil {
		return LotteryDraw{}, err
	}
	if lotteryPoolCost(prizes) <= 0 {
		return LotteryDraw{}, ErrLotteryPoolExhausted
	}
	recharge, err := lotteryRechargeMoney(DB, userId, operation_setting.GetLotterySetting())
	if err != nil {
		return LotteryDraw{}, err
	}
	usage, activeDays, err := lotteryUsageStats(DB, userId, common.GetTimestamp()-14*86400)
	if err != nil {
		return LotteryDraw{}, err
	}
	userFactor := lotteryUserFactor(recharge, usage, activeDays)
	weights := lotteryPrizeWeights(prizes, userFactor, 2, math.Inf(1))
	chosen := pickLotteryPrize(weights, rand.Float64())
	if chosen < 0 {
		return LotteryDraw{}, ErrLotteryPoolExhausted
	}
	quota, err := common.WalletQuotaFromDecimalStrict(
		decimal.NewFromFloat(prizes[chosen].Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
	)
	if err != nil {
		return LotteryDraw{}, err
	}
	return LotteryDraw{UserId: userId, Amount: prizes[chosen].Amount, Quota: quota, UserFactor: userFactor, BudgetFactor: 2, StockSnapshot: lotteryStockSnapshot(prizes)}, nil
}

// lotteryDesignatedPrize 读取数据库中管理员指定的下一次奖励额度及其原始配置值；未指定或值非法时额度为 0
func lotteryDesignatedPrize(tx *gorm.DB) (float64, string, error) {
	var option Option
	if err := tx.Where(&Option{Key: operation_setting.LotteryNextPrizeOptionKey}).Limit(1).Find(&option).Error; err != nil {
		return 0, "", err
	}
	if option.Value == "" {
		return 0, "", nil
	}
	amount, err := operation_setting.ParseLotteryNextPrizeAmount(option.Value)
	if err != nil {
		return 0, option.Value, nil
	}
	return amount, option.Value, nil
}

// takeLotteryDesignatedPrize 在抽奖事务内消费指定奖励：用 CAS 把配置归零，
// 并发抽奖只有一个能拿到；抽奖事务回滚时指定奖励随之保留。
func takeLotteryDesignatedPrize(tx *gorm.DB) (float64, error) {
	amount, raw, err := lotteryDesignatedPrize(tx)
	if err != nil || amount <= 0 {
		return 0, err
	}
	res := tx.Model(&Option{}).
		Where(&Option{Key: operation_setting.LotteryNextPrizeOptionKey, Value: raw}).
		Update("value", "0")
	if res.Error != nil {
		return 0, res.Error
	}
	if res.RowsAffected != 1 {
		return 0, nil
	}
	return amount, nil
}

// GetLotteryStatus 返回用户视角的活动状态（不加锁，只读）
func GetLotteryStatus(userId int) (LotteryStatusInfo, error) {
	s := operation_setting.GetLotterySetting()
	info := LotteryStatusInfo{}
	if err := ensureLotteryPrizes(DB); err != nil {
		return info, err
	}
	if err := DB.Order("amount").Find(&info.Prizes).Error; err != nil {
		return info, err
	}
	recharge, err := lotteryRechargeMoney(DB, userId, s)
	if err != nil {
		return info, err
	}
	var account LotteryAccount
	if err := DB.Where("user_id = ?", userId).First(&account).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return info, err
	}
	totalReward, err := lotteryIssuedAmount(DB, userId)
	if err != nil {
		return info, err
	}
	budget, err := lotteryBudgetRemaining(DB, s)
	if err != nil {
		return info, err
	}
	threshold := s.EffectiveThreshold()
	allowed := lotteryAllowedDraws(recharge, threshold)
	info.Recharge = recharge
	info.DrawsUsed = account.DrawsUsed
	info.DrawsAvailable = allowed - account.DrawsUsed
	if info.DrawsAvailable < 0 {
		info.DrawsAvailable = 0
	}
	info.NextThreshold = threshold - (recharge - float64(allowed)*threshold)
	info.TotalReward = totalReward
	info.BudgetRemaining = budget
	info.Refilling = true
	for _, p := range info.Prizes {
		if p.Stock > 0 && p.Amount <= budget {
			info.Refilling = false
			break
		}
	}
	return info, nil
}

// ensureLotteryAccount 在抽奖事务外确保用户账户行存在。并发首次建账时后到者撞唯一索引，
// 只要最终行存在即视为成功；首次建账把历史抽奖记录数记为已用次数以兼容旧数据。
func ensureLotteryAccount(userId int) error {
	var n int64
	if err := DB.Model(&LotteryAccount{}).Where("user_id = ?", userId).Count(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	var used int64
	if err := DB.Model(&LotteryDraw{}).Where("user_id = ?", userId).Count(&used).Error; err != nil {
		return err
	}
	createErr := DB.Create(&LotteryAccount{UserId: userId, DrawsUsed: int(used)}).Error
	if createErr == nil {
		return nil
	}
	if err := DB.Model(&LotteryAccount{}).Where("user_id = ?", userId).Count(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	return createErr
}

// DrawLottery 在一个事务内完成：校验活动时间 → 锁定用户抽奖账户 → 校验次数 →
// 锁定奖池并按预算/权重抽取 → CAS 扣次数 → CAS 扣库存 → 入账 → 写审计记录。
// 任一步失败整笔回滚，用户次数与库存都不会被消耗。
//
// ignoreWindow 为 true 时（管理员预览）跳过活动时间校验，但活动总开关、次数、预算与库存规则不变。
func DrawLottery(userId int, ignoreWindow bool) (LotteryDraw, error) {
	s := operation_setting.GetLotterySetting()
	if userId <= 0 {
		return LotteryDraw{}, ErrLotteryNoDraws
	}
	if !s.Enabled || (!ignoreWindow && !s.IsActive(common.GetTimestamp())) {
		return LotteryDraw{}, ErrLotteryInactive
	}
	if err := ensureLotteryAccount(userId); err != nil {
		return LotteryDraw{}, err
	}
	var result LotteryDraw
	designated := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := ensureLotteryPrizes(tx); err != nil {
			return err
		}
		// 账户行已在事务外确保存在，这里只会对已存在的行加记录锁，避免 MySQL 对不存在行加间隙锁导致并发建账死锁
		var account LotteryAccount
		if err := lockForUpdate(tx).Where("user_id = ?", userId).First(&account).Error; err != nil {
			return err
		}

		recharge, err := lotteryRechargeMoney(tx, userId, s)
		if err != nil {
			return err
		}
		if lotteryAllowedDraws(recharge, s.EffectiveThreshold()) <= account.DrawsUsed {
			return ErrLotteryNoDraws
		}

		var prizes []LotteryPrize
		if err := lockForUpdate(tx).Order("amount").Find(&prizes).Error; err != nil {
			return err
		}
		designatedAmount, err := takeLotteryDesignatedPrize(tx)
		if err != nil {
			return err
		}
		var prize LotteryPrize
		var userFactor, budgetFactor float64
		if designatedAmount > 0 {
			// 管理员指定了本次奖励：跳过预算与权重直接按指定额度发放；恰好命中有库存的档位时同步扣该档库存
			designated = true
			prize = LotteryPrize{Amount: designatedAmount}
			for _, p := range prizes {
				if p.Amount == designatedAmount && p.Stock > 0 {
					prize = p
					break
				}
			}
		} else {
			poolCost := lotteryPoolCost(prizes)
			if poolCost <= 0 {
				return ErrLotteryPoolExhausted
			}
			budgetRemaining, err := lotteryBudgetRemaining(tx, s)
			if err != nil {
				return err
			}
			budgetFactor = max(budgetRemaining/poolCost, 0)
			usage, activeDays, err := lotteryUsageStats(tx, userId, common.GetTimestamp()-14*86400)
			if err != nil {
				return err
			}
			userFactor = lotteryUserFactor(recharge, usage, activeDays)
			weights := lotteryPrizeWeights(prizes, userFactor, budgetFactor, budgetRemaining)
			chosen := pickLotteryPrize(weights, rand.Float64())
			if chosen < 0 {
				return ErrLotteryRefilling
			}
			prize = prizes[chosen]
		}

		// CAS 扣次数：并发请求只有一个能把 draws_used 从读到的值推进
		res := tx.Model(&LotteryAccount{}).
			Where("id = ? AND draws_used = ?", account.Id, account.DrawsUsed).
			UpdateColumn("draws_used", gorm.Expr("draws_used + 1"))
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected != 1 {
			return ErrLotteryRetry
		}
		// CAS 扣库存：库存被并发抽空时不入账；指定奖励未命中档位时不占用奖池库存
		if prize.Id > 0 {
			res = tx.Model(&LotteryPrize{}).
				Where("id = ? AND stock > 0", prize.Id).
				UpdateColumn("stock", gorm.Expr("stock - 1"))
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected != 1 {
				return ErrLotteryRetry
			}
		}

		quota, err := common.WalletQuotaFromDecimalStrict(
			decimal.NewFromFloat(prize.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
		)
		if err != nil || quota <= 0 {
			return fmt.Errorf("invalid lottery prize quota: %v", err)
		}
		if err := creditTopUpQuota(tx, userId, quota, nil); err != nil {
			return err
		}
		result = LotteryDraw{
			UserId:        userId,
			Amount:        prize.Amount,
			Quota:         quota,
			UserFactor:    userFactor,
			BudgetFactor:  budgetFactor,
			StockSnapshot: lotteryStockSnapshot(prizes),
			CreatedAt:     common.GetTimestamp(),
		}
		return tx.Create(&result).Error
	})
	if err != nil {
		return LotteryDraw{}, err
	}
	syncCreditUserQuotaCache(userId, result.Quota, "lottery")
	if designated {
		if err := updateOptionMap(operation_setting.LotteryNextPrizeOptionKey, "0"); err != nil {
			common.SysError("failed to reset lottery designated prize in memory: " + err.Error())
		}
		common.SysLog(fmt.Sprintf("lottery designated prize %g issued to user %d, draw record %d", result.Amount, userId, result.Id))
	}
	RecordLog(userId, LogTypeTopup, fmt.Sprintf("噜噜抽奖中奖，奖励额度 %s（%g 额度），抽奖记录ID %d", logger.LogQuota(result.Quota), result.Amount, result.Id))
	return result, nil
}

// GetLotteryRecords 返回用户最近的抽奖记录
func GetLotteryRecords(userId int, limit int) ([]LotteryDraw, error) {
	var rows []LotteryDraw
	err := DB.Where("user_id = ?", userId).Order("id DESC").Limit(limit).Find(&rows).Error
	return rows, err
}

// LotteryActivityTime 把活动时间戳格式化为北京时间的 RFC3339 字符串
func LotteryActivityTime(ts int64) string {
	return time.Unix(ts, 0).In(time.FixedZone("Asia/Shanghai", 8*3600)).Format(time.RFC3339)
}

// LotteryWinner 管理员监控用：某个用户的累计中奖汇总
type LotteryWinner struct {
	UserId      int     `json:"user_id"`
	Username    string  `json:"username"`
	Draws       int64   `json:"draws"`
	TotalAmount float64 `json:"total_amount"`
	TotalQuota  int64   `json:"total_quota"`
	LastDrawAt  int64   `json:"last_draw_at"`
}

// LotteryAdminOverview 管理员监控面板的聚合数据
type LotteryAdminOverview struct {
	Prizes          []LotteryPrize  `json:"prizes"`
	TotalRecharge   float64         `json:"total_recharge"`
	BudgetRemaining float64         `json:"budget_remaining"`
	IssuedAmount    float64         `json:"issued_amount"`
	IssuedQuota     int64           `json:"issued_quota"`
	DrawCount       int64           `json:"draw_count"`
	WinnerCount     int64           `json:"winner_count"`
	Winners         []LotteryWinner `json:"winners"`
	NextPrizeAmount float64         `json:"next_prize_amount"`
}

// LotteryDrawWithUser 带用户名的抽奖记录，供管理员列表使用
type LotteryDrawWithUser struct {
	LotteryDraw
	Username string `json:"username"`
}

// lotteryAttachUsernames 批量补齐用户名，避免逐行查询
func lotteryAttachUsernames(userIds []int) (map[int]string, error) {
	names := map[int]string{}
	if len(userIds) == 0 {
		return names, nil
	}
	var users []User
	if err := DB.Select("id, username").Where("id IN ?", userIds).Find(&users).Error; err != nil {
		return nil, err
	}
	for _, u := range users {
		names[u.Id] = u.Username
	}
	return names, nil
}

// GetLotteryAdminOverview 汇总剩余奖券、预算、已发放以及按用户聚合的中奖榜（按累计额度倒序，最多 limit 人）
func GetLotteryAdminOverview(limit int) (LotteryAdminOverview, error) {
	s := operation_setting.GetLotterySetting()
	// 切片显式初始化，保证 JSON 输出为 [] 而不是 null
	overview := LotteryAdminOverview{Prizes: []LotteryPrize{}, Winners: []LotteryWinner{}}
	if err := ensureLotteryPrizes(DB); err != nil {
		return overview, err
	}
	if err := DB.Order("amount").Find(&overview.Prizes).Error; err != nil {
		return overview, err
	}
	var err error
	if overview.TotalRecharge, err = lotteryRechargeMoney(DB, 0, s); err != nil {
		return overview, err
	}
	if overview.BudgetRemaining, err = lotteryBudgetRemaining(DB, s); err != nil {
		return overview, err
	}
	if overview.NextPrizeAmount, _, err = lotteryDesignatedPrize(DB); err != nil {
		return overview, err
	}
	if overview.IssuedAmount, err = lotteryIssuedAmount(DB, 0); err != nil {
		return overview, err
	}
	if err = DB.Model(&LotteryDraw{}).Select("COALESCE(SUM(quota), 0)").Scan(&overview.IssuedQuota).Error; err != nil {
		return overview, err
	}
	if err = DB.Model(&LotteryDraw{}).Count(&overview.DrawCount).Error; err != nil {
		return overview, err
	}
	if err = DB.Model(&LotteryDraw{}).Distinct("user_id").Count(&overview.WinnerCount).Error; err != nil {
		return overview, err
	}
	if limit <= 0 {
		limit = 50
	}
	if err = DB.Model(&LotteryDraw{}).
		Select("user_id, COUNT(*) AS draws, SUM(amount) AS total_amount, SUM(quota) AS total_quota, MAX(created_at) AS last_draw_at").
		Group("user_id").Order("total_amount DESC, user_id ASC").Limit(limit).
		Scan(&overview.Winners).Error; err != nil {
		return overview, err
	}
	ids := make([]int, 0, len(overview.Winners))
	for _, w := range overview.Winners {
		ids = append(ids, w.UserId)
	}
	names, err := lotteryAttachUsernames(ids)
	if err != nil {
		return overview, err
	}
	for i := range overview.Winners {
		overview.Winners[i].Username = names[overview.Winners[i].UserId]
	}
	return overview, nil
}

// GetLotteryDrawsForAdmin 分页返回全站抽奖记录（按时间倒序），keyword 按用户名模糊过滤
func GetLotteryDrawsForAdmin(keyword string, startIdx int, pageSize int) ([]LotteryDrawWithUser, int64, error) {
	query := DB.Model(&LotteryDraw{})
	if keyword != "" {
		var userIds []int
		if err := DB.Model(&User{}).Where("username LIKE ?", "%"+keyword+"%").Pluck("id", &userIds).Error; err != nil {
			return nil, 0, err
		}
		if len(userIds) == 0 {
			return []LotteryDrawWithUser{}, 0, nil
		}
		query = query.Where("user_id IN ?", userIds)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var draws []LotteryDraw
	if err := query.Order("id DESC").Offset(startIdx).Limit(pageSize).Find(&draws).Error; err != nil {
		return nil, 0, err
	}
	ids := make([]int, 0, len(draws))
	for _, d := range draws {
		ids = append(ids, d.UserId)
	}
	names, err := lotteryAttachUsernames(ids)
	if err != nil {
		return nil, 0, err
	}
	items := make([]LotteryDrawWithUser, 0, len(draws))
	for _, d := range draws {
		items = append(items, LotteryDrawWithUser{LotteryDraw: d, Username: names[d.UserId]})
	}
	return items, total, nil
}
