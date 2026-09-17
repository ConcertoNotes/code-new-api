import { useTranslation } from 'react-i18next'

import { Progress } from '@/components/ui/progress'

interface LotteryPoolGridProps {
  remaining: Record<string, number>
  initial: Record<string, number>
}

/** 奖池四档剩余数量与进度，按额度从小到大排列 */
export function LotteryPoolGrid(props: LotteryPoolGridProps) {
  const { t } = useTranslation()
  const tiers = Object.keys(props.initial)
    .map((key) => ({
      key,
      amount: Number(key),
      initial: props.initial[key] ?? 0,
      remaining: props.remaining[key] ?? 0,
    }))
    .sort((a, b) => a.amount - b.amount)

  if (tiers.length === 0) return null

  return (
    <ul
      className='mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4'
      aria-label={t('Prize pool')}
    >
      {tiers.map((tier) => {
        const percent =
          tier.initial > 0
            ? Math.round((tier.remaining / tier.initial) * 100)
            : 0
        return (
          <li
            key={tier.key}
            className='bg-background/70 rounded-lg border border-amber-100 p-3'
          >
            <div className='flex items-baseline justify-between'>
              <span className='text-lg font-semibold text-amber-700'>
                {t('{{amount}} quota', { amount: tier.key })}
              </span>
              <span className='text-muted-foreground text-xs'>
                {t('{{remaining}} / {{total}} left', {
                  remaining: tier.remaining,
                  total: tier.initial,
                })}
              </span>
            </div>
            <Progress
              value={percent}
              className='mt-2'
              aria-label={t('{{amount}} quota remaining', { amount: tier.key })}
            />
          </li>
        )
      })}
    </ul>
  )
}
