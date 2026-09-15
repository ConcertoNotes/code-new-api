import { describe, expect, it } from 'vitest'
import { formatLotteryReward } from '../lottery-card'

describe('formatLotteryReward', () => {
  it('formats numeric reward with quota suffix', () => {
    expect(formatLotteryReward(0.5)).toBe('0.5')
  })
})
