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
import { useTranslation } from 'react-i18next'

import {
  StaticDataTable,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import {
  CHANNEL_STATUS,
  CHANNEL_STATUS_CONFIG,
} from '@/features/channels/constants'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { formatDateTimeObject } from '@/lib/time'
import { cn } from '@/lib/utils'

import { computeProfitRate, formatRatio } from '../lib/profit'
import type { ChannelProfitRow } from '../types'
import { UpstreamRatioCell } from './upstream-ratio-cell'

interface ProfitTableProps {
  rows: ChannelProfitRow[]
  savingChannelId?: number | null
  onUpstreamRatioChange: (channelId: number, ratio: number) => Promise<void>
}

function formatAmount(quota: number): string {
  return formatQuotaWithCurrency(quota, { abbreviate: false })
}

function profitClassName(value: number): string {
  if (value > 0) return 'text-success'
  if (value < 0) return 'text-destructive'
  return 'text-muted-foreground'
}

function ChannelStatusCell(props: { row: ChannelProfitRow }) {
  const { t } = useTranslation()
  if (!props.row.channel_exists) {
    return (
      <StatusBadge
        variant='neutral'
        label={t('Deleted channel')}
        copyable={false}
      />
    )
  }
  const config =
    CHANNEL_STATUS_CONFIG[
      props.row.channel_status as keyof typeof CHANNEL_STATUS_CONFIG
    ] ?? CHANNEL_STATUS_CONFIG[CHANNEL_STATUS.UNKNOWN]
  return (
    <StatusBadge
      variant={config.variant}
      label={t(config.label)}
      copyable={false}
    />
  )
}

/**
 * 渠道 × 分组的收支明细表；同一渠道处于多个分组时会拆成多行分别统计
 */
export function ProfitTable(props: ProfitTableProps) {
  const { t } = useTranslation()

  const columns: StaticDataTableColumn<ChannelProfitRow>[] = [
    {
      id: 'channel',
      header: t('Channel Name'),
      className: 'min-w-40',
      cell: (row) => (
        <div className='flex min-w-0 flex-col'>
          <span
            className={cn(
              'truncate font-medium',
              !row.channel_exists && 'text-muted-foreground'
            )}
            title={row.channel_name}
          >
            {row.channel_exists ? row.channel_name : t('Deleted channel')}
          </span>
          <span className='text-muted-foreground text-[11px]'>
            #{row.channel_id}
          </span>
        </div>
      ),
    },
    {
      id: 'upstream_ratio',
      header: t('Upstream Ratio'),
      className: 'w-32',
      cell: (row) => (
        <UpstreamRatioCell
          channelId={row.channel_id}
          channelName={row.channel_name}
          ratio={row.upstream_ratio}
          saving={props.savingChannelId === row.channel_id}
          onSave={(ratio) => props.onUpstreamRatioChange(row.channel_id, ratio)}
        />
      ),
    },
    {
      id: 'sell_ratio',
      header: t('Sell Ratio / Group'),
      className: 'min-w-36',
      cell: (row) => (
        <div className='flex items-center gap-1.5'>
          <span className='font-mono tabular-nums'>
            {formatRatio(row.sell_ratio)}
          </span>
          <span className='text-muted-foreground'>/</span>
          <GroupBadge group={row.group} />
        </div>
      ),
    },
    {
      id: 'requests',
      header: t('Requests'),
      className: 'w-20 text-right',
      cellClassName: 'text-right font-mono tabular-nums',
      cell: (row) => row.requests.toLocaleString(),
    },
    {
      id: 'quota',
      header: t('Revenue'),
      className: 'w-28 text-right',
      cellClassName: 'text-right font-mono tabular-nums',
      cell: (row) => formatAmount(row.quota),
    },
    {
      id: 'cost',
      header: t('Upstream Cost'),
      className: 'w-28 text-right',
      cellClassName: 'text-right font-mono tabular-nums',
      cell: (row) => formatAmount(row.cost_quota),
    },
    {
      id: 'profit',
      header: t('Realtime Profit'),
      className: 'w-28 text-right',
      cellClassName: (row) =>
        cn(
          'text-right font-mono font-semibold tabular-nums',
          profitClassName(row.profit_quota)
        ),
      cell: (row) => formatAmount(row.profit_quota),
    },
    {
      id: 'rate',
      header: t('Profit Margin'),
      className: 'w-20 text-right',
      cellClassName: (row) =>
        cn(
          'text-right font-mono tabular-nums',
          profitClassName(row.profit_quota)
        ),
      cell: (row) => {
        const rate = computeProfitRate(row.profit_quota, row.quota)
        return rate == null ? '-' : `${rate.toFixed(1)}%`
      },
    },
    {
      id: 'last_used',
      header: t('Last Used'),
      className: 'w-40',
      cellClassName: 'text-muted-foreground text-xs tabular-nums',
      cell: (row) =>
        row.last_used_at > 0
          ? formatDateTimeObject(new Date(row.last_used_at * 1000))
          : '-',
    },
    {
      id: 'status',
      header: t('Status'),
      className: 'w-24',
      cell: (row) => <ChannelStatusCell row={row} />,
    },
  ]

  return (
    <StaticDataTable
      columns={columns}
      data={props.rows}
      getRowKey={(row) => `${row.channel_id}-${row.group}`}
      emptyContent={t('No channel usage in the selected range')}
    />
  )
}
