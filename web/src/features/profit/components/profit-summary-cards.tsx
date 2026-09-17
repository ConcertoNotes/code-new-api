/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import {
  Coins,
  HandCoins,
  PiggyBank,
  Percent,
  Radio,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

import { computeProfitRate } from '../lib/profit'
import type { ChannelProfitSummary } from '../types'

interface ProfitSummaryCardsProps {
  summary?: ChannelProfitSummary
  loading?: boolean
}

type SummaryCard = {
  key: string
  title: string
  value: string
  description: string
  icon: LucideIcon
  tone: IconBadgeTone
  valueClassName?: string
}

function formatAmount(quota: number): string {
  return formatQuotaWithCurrency(quota, { abbreviate: false })
}

function SummaryCardItem(props: { card: SummaryCard; loading?: boolean }) {
  const Icon = props.card.icon
  return (
    <div className='bg-card flex min-h-28 flex-col justify-between gap-3 rounded-2xl border p-4 shadow-xs'>
      <div className='flex items-center gap-2'>
        <IconBadge tone={props.card.tone} size='md' decorative>
          <Icon aria-hidden='true' />
        </IconBadge>
        <span className='text-muted-foreground text-xs font-medium'>
          {props.card.title}
        </span>
      </div>
      {props.loading ? (
        <div className='flex flex-col gap-1.5'>
          <Skeleton className='h-7 w-28' />
          <Skeleton className='h-3 w-20' />
        </div>
      ) : (
        <div className='flex flex-col gap-1'>
          <div
            className={cn(
              'text-foreground truncate font-mono text-xl font-semibold tracking-tight tabular-nums sm:text-2xl',
              props.card.valueClassName
            )}
            title={props.card.value}
          >
            {props.card.value}
          </div>
          <p className='text-muted-foreground/70 truncate text-[11px] sm:text-xs'>
            {props.card.description}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * 顶部汇总卡片：总收入、上游成本、实时利润、利润率、活跃渠道数
 */
export function ProfitSummaryCards(props: ProfitSummaryCardsProps) {
  const { t } = useTranslation()
  const summary = props.summary
  const quota = summary?.quota ?? 0
  const cost = summary?.cost_quota ?? 0
  const profit = summary?.profit_quota ?? 0
  const rate = computeProfitRate(profit, quota)
  const requests = summary?.requests ?? 0
  const profitTone: IconBadgeTone = profit < 0 ? 'destructive' : 'success'

  const cards: SummaryCard[] = [
    {
      key: 'revenue',
      title: t('Total Revenue'),
      value: formatAmount(quota),
      description: t('{{count}} requests billed', { count: requests }),
      icon: Coins,
      tone: 'success',
    },
    {
      key: 'cost',
      title: t('Upstream Cost'),
      value: formatAmount(cost),
      description: t('Official price × upstream ratio'),
      icon: HandCoins,
      tone: 'destructive',
    },
    {
      key: 'profit',
      title: t('Realtime Profit'),
      value: formatAmount(profit),
      description: t('Revenue − upstream cost'),
      icon: PiggyBank,
      tone: profitTone,
      valueClassName: profit < 0 ? 'text-destructive' : 'text-success',
    },
    {
      key: 'rate',
      title: t('Profit Margin'),
      value: rate == null ? '-' : `${rate.toFixed(1)}%`,
      description: t('Profit / revenue'),
      icon: Percent,
      tone: 'chart-4',
      valueClassName: rate != null && rate < 0 ? 'text-destructive' : undefined,
    },
    {
      key: 'channels',
      title: t('Active Channels'),
      value: String(summary?.active_channels ?? 0),
      description: t('{{count}} channels in total', {
        count: summary?.total_channels ?? 0,
      }),
      icon: Radio,
      tone: 'warning',
    },
  ]

  return (
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5'>
      {cards.map((card) => (
        <SummaryCardItem key={card.key} card={card} loading={props.loading} />
      ))}
    </div>
  )
}
