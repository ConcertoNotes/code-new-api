package service

import (
	"errors"
	"math/rand"
	"sync"
)

type Prize struct {
	Amount float64
	Stock  int
}
type UserStats struct {
	Recharge, Usage float64
	ActiveDays      int
}
type BudgetState struct{ Remaining, Reserve float64 }
type DrawResult struct {
	Amount                   float64
	Remaining                int
	UserFactor, BudgetFactor float64
}

type LotteryPool struct {
	mu     sync.Mutex
	Prizes []Prize
	rng    *rand.Rand
}

func NewLotteryPool(prizes []Prize) *LotteryPool {
	cp := append([]Prize(nil), prizes...)
	return &LotteryPool{Prizes: cp, rng: rand.New(rand.NewSource(1))}
}
func (p *LotteryPool) Remaining() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	n := 0
	for _, x := range p.Prizes {
		n += x.Stock
	}
	return n
}
func userFactor(s UserStats) float64 {
	r := s.Recharge / 200
	if r > 1 {
		r = 1
	}
	if r < 0 {
		r = 0
	}
	u := s.Usage / s.Recharge
	if s.Recharge <= 0 {
		u = 0
	}
	if u > 1 {
		u = 1
	}
	if u < 0 {
		u = 0
	}
	d := float64(s.ActiveDays) / 14
	if d > 1 {
		d = 1
	}
	if d < 0 {
		d = 0
	}
	return .5 + .25*r + .15*u + .1*d
}
func (p *LotteryPool) Draw(s UserStats, b BudgetState) (DrawResult, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	total := 0
	for _, x := range p.Prizes {
		if x.Stock > 0 {
			total += x.Stock
		}
	}
	if total == 0 {
		return DrawResult{}, errors.New("lottery pool exhausted")
	}
	uf := userFactor(s)
	est := 0.
	for _, x := range p.Prizes {
		est += x.Amount * float64(x.Stock)
	}
	bf := 1.
	if est > 0 {
		bf = (b.Remaining - b.Reserve) / est
	}
	if bf < 0 {
		bf = 0
	}
	weights := make([]float64, len(p.Prizes))
	sum := 0.
	for i, x := range p.Prizes {
		if x.Stock <= 0 {
			continue
		}
		w := float64(x.Stock)
		if x.Amount >= 5 {
			if bf < .5 {
				continue
			}
			if bf < 1 {
				w *= .7
			}
			if x.Amount == 5 {
				w *= .75 + .25*uf
			} else {
				w *= .55 + .45*uf
			}
			w *= bf
		}
		weights[i] = w
		sum += w
	}
	if sum == 0 {
		return DrawResult{}, errors.New("lottery budget exhausted")
	}
	pick := p.rng.Float64() * sum
	idx := 0
	for i, w := range weights {
		if w > 0 {
			pick -= w
			if pick <= 0 {
				idx = i
				break
			}
		}
	}
	p.Prizes[idx].Stock--
	rem := 0
	for _, x := range p.Prizes {
		rem += x.Stock
	}
	return DrawResult{Amount: p.Prizes[idx].Amount, Remaining: rem, UserFactor: uf, BudgetFactor: bf}, nil
}
