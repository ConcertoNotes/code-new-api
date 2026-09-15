package service

import "testing"

func TestLotteryPoolDrawRespectsInventoryAndWeights(t *testing.T) {
	p := NewLotteryPool([]Prize{{Amount: 0.5, Stock: 2}, {Amount: 1, Stock: 1}, {Amount: 10, Stock: 1}})
	r, err := p.Draw(UserStats{Recharge: 200, Usage: 100, ActiveDays: 14}, BudgetState{Remaining: 100, Reserve: 0})
	if err != nil || r.Amount <= 0 {
		t.Fatalf("draw failed: %v %+v", err, r)
	}
	if p.Remaining() != 3 {
		t.Fatalf("remaining=%d", p.Remaining())
	}
}

func TestLotteryBudgetStopsLargePrizeWhenInsufficient(t *testing.T) {
	p := NewLotteryPool([]Prize{{Amount: 0.5, Stock: 1}, {Amount: 10, Stock: 1}})
	_, err := p.Draw(UserStats{}, BudgetState{Remaining: 1, Reserve: 0})
	if err != nil {
		t.Fatal(err)
	}
	if p.Prizes[1].Stock != 1 {
		t.Fatalf("large prize should be held")
	}
}

func TestLotteryPoolDrawExhausted(t *testing.T) {
	p := NewLotteryPool([]Prize{{Amount: 1, Stock: 1}})
	_, _ = p.Draw(UserStats{}, BudgetState{Remaining: 10})
	if _, err := p.Draw(UserStats{}, BudgetState{Remaining: 10}); err == nil {
		t.Fatal("expected exhausted error")
	}
}
