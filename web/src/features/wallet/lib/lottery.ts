import type { LotteryDrawErrorCode } from '../lottery-api'

export function formatLotteryReward(reward: number): string {
  return Number.isInteger(reward) ? String(reward) : reward.toFixed(1)
}

/** 把后端返回的错误码映射为提示文案的 i18n key */
export function lotteryErrorMessageKey(
  code: LotteryDrawErrorCode | undefined
): string {
  switch (code) {
    case 'pool_refilling':
      return 'The prize pool is refilling, your draw is kept. Try again later.'
    case 'retry':
      return 'Too many requests at once, please try again.'
    case 'no_draws':
      return 'No draws available yet'
    case 'inactive':
      return 'The event is not running right now'
    case 'pool_exhausted':
      return 'All prizes have been claimed'
    default:
      return 'Lottery draw failed'
  }
}
