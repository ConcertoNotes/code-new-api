import { describe, expect, it } from 'vitest'

import { formatLotteryReward, lotteryErrorMessageKey } from '../../lib/lottery'

describe('formatLotteryReward', () => {
  it('keeps integers without a decimal point', () => {
    expect(formatLotteryReward(5)).toBe('5')
  })

  it('formats fractional rewards with one decimal', () => {
    expect(formatLotteryReward(0.5)).toBe('0.5')
  })
})

describe('lotteryErrorMessageKey', () => {
  it('maps a refilling pool to the draw-kept message', () => {
    expect(lotteryErrorMessageKey('pool_refilling')).toBe(
      'The prize pool is refilling, your draw is kept. Try again later.'
    )
  })

  it('maps unknown or missing codes to the generic failure message', () => {
    expect(lotteryErrorMessageKey(undefined)).toBe('Lottery draw failed')
    expect(lotteryErrorMessageKey('failed')).toBe('Lottery draw failed')
  })
})
