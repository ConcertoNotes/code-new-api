package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLotteryPrizeWeightsRespectBudgetAndTiers(t *testing.T) {
	prizes := []LotteryPrize{{Amount: 0.5, Stock: 100}, {Amount: 1, Stock: 30}, {Amount: 5, Stock: 10}, {Amount: 10, Stock: 5}}
	tests := []struct {
		name            string
		userFactor      float64
		budgetFactor    float64
		budgetRemaining float64
		want            []float64
	}{
		{
			name:            "budget below smallest prize blocks every tier",
			userFactor:      1,
			budgetFactor:    0,
			budgetRemaining: 0.4,
			want:            []float64{0, 0, 0, 0},
		},
		{
			name:            "budget factor below 1 keeps only small prizes",
			userFactor:      1,
			budgetFactor:    0.6,
			budgetRemaining: 20,
			want:            []float64{100, 30, 0, 0},
		},
		{
			name:            "budget factor between 1 and 1.5 scales big prizes by 0.7",
			userFactor:      1,
			budgetFactor:    1.2,
			budgetRemaining: 200,
			want:            []float64{100, 30, 7, 3.5},
		},
		{
			name:            "full budget uses user factor weights",
			userFactor:      0.5,
			budgetFactor:    2,
			budgetRemaining: 200,
			want:            []float64{100, 30, 8.75, 3.875},
		},
		{
			name:            "hard cap excludes prizes above remaining budget even with full factor",
			userFactor:      1,
			budgetFactor:    2,
			budgetRemaining: 6,
			want:            []float64{100, 30, 10, 0},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := lotteryPrizeWeights(prizes, tt.userFactor, tt.budgetFactor, tt.budgetRemaining)
			require.Len(t, got, len(tt.want))
			for i := range tt.want {
				assert.InDelta(t, tt.want[i], got[i], 1e-9, "weight %d", i)
			}
		})
	}
}

func TestLotteryPrizeWeightsAllowBigPrizeWhenSmallStockIsGone(t *testing.T) {
	prizes := []LotteryPrize{{Amount: 0.5, Stock: 0}, {Amount: 1, Stock: 0}, {Amount: 5, Stock: 2}, {Amount: 10, Stock: 1}}
	got := lotteryPrizeWeights(prizes, 1, 0.5, 6)
	assert.Equal(t, []float64{0, 0, 1.4, 0}, got)
}

func TestPickLotteryPrizeFollowsCumulativeWeights(t *testing.T) {
	weights := []float64{1, 0, 3}
	assert.Equal(t, 0, pickLotteryPrize(weights, 0))
	assert.Equal(t, 0, pickLotteryPrize(weights, 0.24))
	assert.Equal(t, 2, pickLotteryPrize(weights, 0.25))
	assert.Equal(t, 2, pickLotteryPrize(weights, 0.999))
	assert.Equal(t, -1, pickLotteryPrize([]float64{0, 0}, 0.5))
}

func TestLotteryAllowedDraws(t *testing.T) {
	assert.Equal(t, 0, lotteryAllowedDraws(19.99, 20))
	assert.Equal(t, 1, lotteryAllowedDraws(20, 20))
	assert.Equal(t, 2, lotteryAllowedDraws(59.5, 20))
	assert.Equal(t, 0, lotteryAllowedDraws(100, 0))
	assert.Equal(t, 0, lotteryAllowedDraws(-5, 20))
}

func TestLotteryUserFactorBounds(t *testing.T) {
	assert.InDelta(t, 0.5, lotteryUserFactor(0, 0, 0), 1e-9)
	assert.InDelta(t, 1, lotteryUserFactor(1000, 1000, 30), 1e-9)
	assert.InDelta(t, 0.5+0.25*0.1+0.15*0.5+0.1*0.5, lotteryUserFactor(20, 10, 7), 1e-9)
}

// withLotteryActivity 把活动配置设为“当前进行中”，并在测试结束后恢复原值
func withLotteryActivity(t *testing.T, ratio float64, reserve float64) *operation_setting.LotterySetting {
	t.Helper()
	s := operation_setting.GetLotterySetting()
	saved := *s
	savedPrice := operation_setting.Price
	now := common.GetTimestamp()
	s.Enabled = true
	s.StartTime = now - 3600
	s.EndTime = now + 3600
	s.ThresholdMoney = 20
	s.PayoutRatio = ratio
	s.ReserveQuota = reserve
	operation_setting.Price = 7.3
	t.Cleanup(func() {
		*s = saved
		operation_setting.Price = savedPrice
	})
	return s
}

// lotteryDrawsUsed 读取用户已用次数；账户行随失败事务回滚时视为 0
func lotteryDrawsUsed(t *testing.T, userId int) int64 {
	t.Helper()
	var used int64
	require.NoError(t, DB.Model(&LotteryAccount{}).Where("user_id = ?", userId).Select("COALESCE(SUM(draws_used), 0)").Scan(&used).Error)
	return used
}

func seedLotteryTopUp(t *testing.T, userId int, money float64, completeTime int64, provider string, status string) {
	t.Helper()
	require.NoError(t, DB.Create(&TopUp{
		UserId:          userId,
		Amount:          1,
		Money:           money,
		TradeNo:         common.GetRandomString(16),
		PaymentMethod:   "alipay",
		PaymentProvider: provider,
		CreateTime:      completeTime,
		CompleteTime:    completeTime,
		Status:          status,
	}).Error)
}

func TestDrawLotteryCreditsExactPrizeToCorrectUserOnce(t *testing.T) {
	truncateTables(t)
	s := withLotteryActivity(t, 1, 0) // 预算充足，不影响本用例
	now := common.GetTimestamp()
	winner := User{Username: "lottery-winner", Quota: 1000, AffCode: "lotw"}
	bystander := User{Username: "lottery-bystander", Quota: 777, AffCode: "lotb"}
	require.NoError(t, DB.Create(&winner).Error)
	require.NoError(t, DB.Create(&bystander).Error)
	seedLotteryTopUp(t, winner.Id, 20, now-60, PaymentProviderEpay, common.TopUpStatusSuccess)
	seedLotteryTopUp(t, bystander.Id, 500, now-60, PaymentProviderEpay, common.TopUpStatusSuccess)

	status, err := GetLotteryStatus(winner.Id)
	require.NoError(t, err)
	assert.Equal(t, 1, status.DrawsAvailable)
	assert.InDelta(t, 20, status.NextThreshold, 1e-9)

	result, err := DrawLottery(winner.Id, false)
	require.NoError(t, err)
	require.Contains(t, []float64{1, 2, 5, 10}, result.Amount)
	expectedQuota := int(result.Amount * common.QuotaPerUnit)
	assert.Equal(t, expectedQuota, result.Quota)

	var refreshedWinner, refreshedBystander User
	require.NoError(t, DB.First(&refreshedWinner, winner.Id).Error)
	require.NoError(t, DB.First(&refreshedBystander, bystander.Id).Error)
	assert.Equal(t, 1000+expectedQuota, refreshedWinner.Quota, "中奖额度必须精确加到中奖用户")
	assert.Equal(t, 777, refreshedBystander.Quota, "其他用户余额不能变化")

	var prize LotteryPrize
	require.NoError(t, DB.Where("amount = ?", result.Amount).First(&prize).Error)
	assert.Equal(t, prize.InitialStock-1, prize.Stock)

	var account LotteryAccount
	require.NoError(t, DB.Where("user_id = ?", winner.Id).First(&account).Error)
	assert.Equal(t, 1, account.DrawsUsed)

	var logCount int64
	require.NoError(t, DB.Model(&Log{}).Where("user_id = ? AND type = ?", winner.Id, LogTypeTopup).Count(&logCount).Error)
	assert.Equal(t, int64(1), logCount, "中奖必须写入充值类型日志便于用户和管理员审计")

	_, err = DrawLottery(winner.Id, false)
	assert.ErrorIs(t, err, ErrLotteryNoDraws, "20 元只有一次机会，第二次必须拒绝")
	require.NoError(t, DB.First(&refreshedWinner, winner.Id).Error)
	assert.Equal(t, 1000+expectedQuota, refreshedWinner.Quota)

	// 活动结束后即使还有次数也不能抽
	s.EndTime = now - 1
	seedLotteryTopUp(t, winner.Id, 20, now-30, PaymentProviderEpay, common.TopUpStatusSuccess)
	_, err = DrawLottery(winner.Id, false)
	assert.ErrorIs(t, err, ErrLotteryInactive)
}

func TestLotteryRechargeOnlyCountsRealPaymentsInsideWindow(t *testing.T) {
	truncateTables(t)
	s := withLotteryActivity(t, 1, 0)
	now := common.GetTimestamp()
	user := User{Username: "lottery-window", Quota: 0, AffCode: "lotwin"}
	require.NoError(t, DB.Create(&user).Error)
	seedLotteryTopUp(t, user.Id, 100, s.StartTime-10, PaymentProviderEpay, common.TopUpStatusSuccess) // 活动前
	seedLotteryTopUp(t, user.Id, 100, s.EndTime+10, PaymentProviderEpay, common.TopUpStatusSuccess)   // 活动后
	seedLotteryTopUp(t, user.Id, 100, now-10, PaymentProviderEpay, common.TopUpStatusPending)         // 未支付
	seedLotteryTopUp(t, user.Id, 100, now-10, PaymentProviderBalance, common.TopUpStatusSuccess)      // 余额购买订阅
	seedLotteryTopUp(t, user.Id, 39.9, now-10, PaymentProviderEpay, common.TopUpStatusSuccess)        // 活动内真实付款

	status, err := GetLotteryStatus(user.Id)
	require.NoError(t, err)
	assert.InDelta(t, 39.9, status.Recharge, 1e-9)
	assert.Equal(t, 1, status.DrawsAvailable)
	assert.InDelta(t, 0.1, status.NextThreshold, 1e-9)
}

func TestDrawLotteryHoldsDrawWhenBudgetCannotAffordAnyPrize(t *testing.T) {
	truncateTables(t)
	// 回馈比例 1%：20 元 / 7.3 × 0.01 ≈ 0.027 额度，连最小奖 1 额度都发不起
	withLotteryActivity(t, 0.01, 0)
	now := common.GetTimestamp()
	user := User{Username: "lottery-budget", Quota: 100, AffCode: "lotbud"}
	require.NoError(t, DB.Create(&user).Error)
	seedLotteryTopUp(t, user.Id, 20, now-60, PaymentProviderEpay, common.TopUpStatusSuccess)

	status, err := GetLotteryStatus(user.Id)
	require.NoError(t, err)
	assert.True(t, status.Refilling)
	assert.Equal(t, 1, status.DrawsAvailable)

	_, err = DrawLottery(user.Id, false)
	assert.ErrorIs(t, err, ErrLotteryRefilling)

	var refreshed User
	require.NoError(t, DB.First(&refreshed, user.Id).Error)
	assert.Equal(t, 100, refreshed.Quota, "预算不足时不能入账")
	assert.Equal(t, int64(0), lotteryDrawsUsed(t, user.Id), "预算不足时机会必须保留")
	var totalStock int64
	require.NoError(t, DB.Model(&LotteryPrize{}).Select("COALESCE(SUM(stock), 0)").Scan(&totalStock).Error)
	assert.Equal(t, int64(135), totalStock)
}

func TestDrawLotteryBudgetCapsTotalPayoutAcrossUsers(t *testing.T) {
	truncateTables(t)
	// 全站充值 73 元 → 10 额度 × 12% = 1.2 额度预算：只够发一张 1 额度，再抽必须被挡住
	withLotteryActivity(t, 0.12, 0)
	now := common.GetTimestamp()
	user := User{Username: "lottery-cap", Quota: 0, AffCode: "lotcap"}
	require.NoError(t, DB.Create(&user).Error)
	seedLotteryTopUp(t, user.Id, 73, now-60, PaymentProviderEpay, common.TopUpStatusSuccess)

	first, err := DrawLottery(user.Id, false)
	require.NoError(t, err)
	assert.InDelta(t, 1, first.Amount, 1e-9)

	_, err = DrawLottery(user.Id, false)
	assert.ErrorIs(t, err, ErrLotteryRefilling)

	issued, err := lotteryIssuedAmount(DB, 0)
	require.NoError(t, err)
	assert.LessOrEqual(t, issued, 73/7.3*0.12+1e-9, "累计发放不能超过充值额 × 回馈比例")
}

func TestDrawLotteryRollsBackWhenCreditFails(t *testing.T) {
	truncateTables(t)
	withLotteryActivity(t, 1, 0)
	now := common.GetTimestamp()
	user := User{Username: "lottery-full-wallet", Quota: common.MaxWalletQuota, AffCode: "lotful"}
	require.NoError(t, DB.Create(&user).Error)
	seedLotteryTopUp(t, user.Id, 20, now-60, PaymentProviderEpay, common.TopUpStatusSuccess)
	_, err := GetLotteryStatus(user.Id) // 先初始化奖池，确保失败事务回滚的是库存扣减而不是建池
	require.NoError(t, err)

	_, err = DrawLottery(user.Id, false)
	require.ErrorIs(t, err, ErrTopUpQuotaLimitExceeded)

	assert.Equal(t, int64(0), lotteryDrawsUsed(t, user.Id), "入账失败整笔回滚，机会保留")
	var totalStock int64
	require.NoError(t, DB.Model(&LotteryPrize{}).Select("COALESCE(SUM(stock), 0)").Scan(&totalStock).Error)
	assert.Equal(t, int64(135), totalStock, "入账失败库存不能减少")
	var draws int64
	require.NoError(t, DB.Model(&LotteryDraw{}).Count(&draws).Error)
	assert.Equal(t, int64(0), draws)
}

func TestDrawLotteryAdminBypassesWindowButNotSwitch(t *testing.T) {
	truncateTables(t)
	s := withLotteryActivity(t, 1, 0)
	now := common.GetTimestamp()
	s.StartTime = now + 3600 // 活动尚未开始
	s.EndTime = now + 7200
	admin := User{Username: "lottery-admin", Quota: 0, AffCode: "lotadm", Role: common.RoleAdminUser}
	require.NoError(t, DB.Create(&admin).Error)
	// 窗口外的充值不算，所以把窗口内的充值时间放在未来开始之后
	seedLotteryTopUp(t, admin.Id, 20, now+3700, PaymentProviderEpay, common.TopUpStatusSuccess)

	_, err := DrawLottery(admin.Id, false)
	assert.ErrorIs(t, err, ErrLotteryInactive, "普通身份在活动前不能抽")

	result, err := DrawLottery(admin.Id, true)
	require.NoError(t, err, "管理员预览可以跳过时间限制")
	assert.Greater(t, result.Quota, 0)

	s.Enabled = false
	_, err = DrawLottery(admin.Id, true)
	assert.ErrorIs(t, err, ErrLotteryInactive, "总开关关闭时管理员也不能抽")
}

func TestEnsureLotteryPrizesReseedsOnlyWhenNoDrawsExist(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&LotteryPrize{Amount: 0.5, Stock: 100, InitialStock: 100}).Error)

	require.NoError(t, ensureLotteryPrizes(DB))
	var prizes []LotteryPrize
	require.NoError(t, DB.Order("amount").Find(&prizes).Error)
	require.Len(t, prizes, 4)
	assert.Equal(t, []float64{1, 2, 5, 10}, []float64{prizes[0].Amount, prizes[1].Amount, prizes[2].Amount, prizes[3].Amount})
	assert.Equal(t, []int{80, 40, 10, 5}, []int{prizes[0].InitialStock, prizes[1].InitialStock, prizes[2].InitialStock, prizes[3].InitialStock})

	// 已有抽奖记录时，即使库存被手工改过也不能重建
	require.NoError(t, DB.Model(&LotteryPrize{}).Where("amount = ?", 10).UpdateColumn("initial_stock", 7).Error)
	require.NoError(t, DB.Create(&LotteryDraw{UserId: 1, Amount: 1, Quota: 500000, CreatedAt: 1}).Error)
	require.NoError(t, ensureLotteryPrizes(DB))
	var big LotteryPrize
	require.NoError(t, DB.Where("amount = ?", 10).First(&big).Error)
	assert.Equal(t, 7, big.InitialStock)
}

func TestPreviewLotteryHasNoSideEffects(t *testing.T) {
	truncateTables(t)
	withLotteryActivity(t, 0.01, 0) // 预算几乎为 0，真实抽奖会被挡住，预览不受影响
	admin := User{Username: "lottery-preview", Quota: 5, AffCode: "lotpre", Role: common.RoleAdminUser}
	require.NoError(t, DB.Create(&admin).Error)

	result, err := PreviewLottery(admin.Id)
	require.NoError(t, err)
	assert.Contains(t, []float64{1, 2, 5, 10}, result.Amount)
	assert.Equal(t, int(result.Amount*common.QuotaPerUnit), result.Quota)

	var refreshed User
	require.NoError(t, DB.First(&refreshed, admin.Id).Error)
	assert.Equal(t, 5, refreshed.Quota, "预览不能入账")
	var totalStock int64
	require.NoError(t, DB.Model(&LotteryPrize{}).Select("COALESCE(SUM(stock), 0)").Scan(&totalStock).Error)
	assert.Equal(t, int64(135), totalStock, "预览不能扣库存")
	var draws int64
	require.NoError(t, DB.Model(&LotteryDraw{}).Count(&draws).Error)
	assert.Equal(t, int64(0), draws, "预览不能写抽奖记录")
	assert.Equal(t, int64(0), lotteryDrawsUsed(t, admin.Id))
}
