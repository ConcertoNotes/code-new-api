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
import { GripVertical, RotateCcw, Trash2 } from 'lucide-react'
import { useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'

import {
  StaticDataTable,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
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
  /** 拖拽后回调：把 dragKey 移动到 targetKey 的位置 */
  onReorder: (dragKey: string, targetKey: string) => void
  onHide: (row: ChannelProfitRow) => void
  onRestore: (row: ChannelProfitRow) => void
}

function formatAmount(quota: number): string {
  return formatQuotaWithCurrency(quota, { abbreviate: false })
}

function profitClassName(value: number): string {
  if (value > 0) return 'text-success'
  if (value < 0) return 'text-destructive'
  return 'text-muted-foreground'
}

function resolveCellClassName(
  column: StaticDataTableColumn<ChannelProfitRow>,
  row: ChannelProfitRow,
  index: number
): string | undefined {
  if (typeof column.cellClassName === 'function') {
    return column.cellClassName(row, index)
  }
  return column.cellClassName
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
 * 渠道 × 分组的收支明细表；同一渠道处于多个分组时会拆成多行分别统计。
 * 左侧拖拽手柄可调整顺序，右侧可把行从收支页移除或恢复。
 */
export function ProfitTable(props: ProfitTableProps) {
  const { t } = useTranslation()
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)

  const finishDrag = () => {
    setDragKey(null)
    setOverKey(null)
  }

  const handleDrop = (event: DragEvent<HTMLTableRowElement>, target: string) => {
    event.preventDefault()
    const source = dragKey ?? event.dataTransfer.getData('text/plain')
    if (source && source !== target) {
      props.onReorder(source, target)
    }
    finishDrag()
  }

  const columns: StaticDataTableColumn<ChannelProfitRow>[] = [
    {
      id: 'drag',
      header: '',
      className: 'w-8',
      cellClassName: 'w-8 px-1',
      cell: (row) => (
        <span
          role='button'
          tabIndex={0}
          draggable
          aria-label={t('Drag to reorder {{name}}', { name: row.channel_name })}
          title={t('Drag to reorder')}
          className='text-muted-foreground hover:text-foreground flex cursor-grab items-center justify-center rounded p-1 active:cursor-grabbing'
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', row.key)
            setDragKey(row.key)
          }}
          onDragEnd={finishDrag}
        >
          <GripVertical className='size-4' aria-hidden='true' />
        </span>
      ),
    },
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
    {
      id: 'actions',
      header: '',
      className: 'w-12',
      cellClassName: 'px-1 text-right',
      cell: (row) =>
        row.hidden ? (
          <Button
            type='button'
            variant='ghost'
            size='icon-xs'
            aria-label={t('Restore {{name}} to the ledger', {
              name: row.channel_name,
            })}
            title={t('Restore')}
            onClick={() => props.onRestore(row)}
          >
            <RotateCcw />
          </Button>
        ) : (
          <Button
            type='button'
            variant='ghost'
            size='icon-xs'
            className='text-muted-foreground hover:text-destructive'
            aria-label={t('Remove {{name}} from the ledger', {
              name: row.channel_name,
            })}
            title={t('Remove')}
            onClick={() => props.onHide(row)}
          >
            <Trash2 />
          </Button>
        ),
    },
  ]

  return (
    <StaticDataTable
      columns={columns}
      data={props.rows}
      emptyContent={t('No channel usage in the selected range')}
      renderRow={(row, index) => (
        <TableRow
          key={row.key}
          data-row-key={row.key}
          className={cn(
            row.hidden && 'opacity-50',
            overKey === row.key && dragKey !== row.key && 'bg-primary/10',
            dragKey === row.key && 'opacity-40'
          )}
          onDragOver={(event) => {
            if (!dragKey) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            if (overKey !== row.key) setOverKey(row.key)
          }}
          onDragLeave={() => {
            if (overKey === row.key) setOverKey(null)
          }}
          onDrop={(event) => handleDrop(event, row.key)}
        >
          {columns.map((column) => (
            <TableCell
              key={column.id}
              className={cn(
                'max-w-full min-w-0 overflow-hidden',
                resolveCellClassName(column, row, index)
              )}
            >
              {column.cell?.(row, index)}
            </TableCell>
          ))}
        </TableRow>
      )}
    />
  )
}
