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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Download,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  Search,
  TimerReset,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionPageLayout } from '@/components/layout'
import { FadeIn } from '@/components/page-transition'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { PanelWrapper } from '@/features/dashboard/components/ui/panel-wrapper'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
import { formatQuotaWithCurrency } from '@/lib/currency'
import dayjs from '@/lib/dayjs'
import { handleServerError } from '@/lib/handle-server-error'
import { formatDateTimeObject } from '@/lib/time'
import { cn } from '@/lib/utils'

import {
  getChannelProfitStats,
  updateChannelUpstreamRatio,
  updateProfitSettings,
} from './api'
import { ProfitChannelChart, ProfitTrendChart } from './components/profit-charts'
import { ProfitFormulaPanel } from './components/profit-formula-panel'
import { ProfitSummaryCards } from './components/profit-summary-cards'
import { ProfitTable } from './components/profit-table'
import {
  ALL_GROUPS_FILTER,
  buildProfitCsv,
  collectProfitGroups,
  filterProfitRows,
  getTimezoneOffsetSeconds,
  moveRowKey,
  sortRowsByOrder,
} from './lib/profit'
import type {
  ChannelProfitRow,
  ProfitSettingsPayload,
  ProfitStatusFilter,
} from './types'

// 收支数据每 30 秒自动刷新一次，保证“实时”
const PROFIT_REFRESH_INTERVAL_MS = 30_000
const DEFAULT_RANGE_DAYS = 30

function defaultRange(): { start: Date; end: Date } {
  const now = dayjs()
  return {
    start: now.subtract(DEFAULT_RANGE_DAYS - 1, 'day').startOf('day').toDate(),
    end: now.endOf('day').toDate(),
  }
}

export function ProfitDashboard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [range, setRange] = useState(defaultRange)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ProfitStatusFilter>('all')
  const [group, setGroup] = useState(ALL_GROUPS_FILTER)
  const [savingChannelId, setSavingChannelId] = useState<number | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  // 关闭确认框时保留待移除的行，避免退场动画期间文案变空
  const [pendingHideRow, setPendingHideRow] = useState<ChannelProfitRow | null>(
    null
  )
  const [hideConfirmOpen, setHideConfirmOpen] = useState(false)
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false)
  // 拖拽后的本地顺序，用于在服务端刷新前立即呈现新顺序
  const [localOrder, setLocalOrder] = useState<string[] | null>(null)

  const params = useMemo(
    () => ({
      start_timestamp: Math.floor(range.start.getTime() / 1000),
      end_timestamp: Math.floor(range.end.getTime() / 1000),
      tz_offset: getTimezoneOffsetSeconds(),
    }),
    [range]
  )

  const statsQuery = useQuery({
    queryKey: ['profit', 'stats', params],
    queryFn: async () => {
      const res = await getChannelProfitStats(params)
      if (!res.success || !res.data) {
        throw new Error(res.message || t('Failed to load profit data'))
      }
      return res.data
    },
    refetchInterval: PROFIT_REFRESH_INTERVAL_MS,
  })

  const ratioMutation = useMutation({
    mutationFn: async (payload: { channel_id: number; ratio: number }) => {
      setSavingChannelId(payload.channel_id)
      const res = await updateChannelUpstreamRatio(payload)
      if (!res.success) {
        throw new Error(res.message || t('Failed to update upstream ratio'))
      }
      return payload
    },
    onSuccess: async () => {
      toast.success(t('Upstream ratio updated'))
      await queryClient.invalidateQueries({ queryKey: ['profit', 'stats'] })
    },
    onError: (error) => handleServerError(error),
    onSettled: () => setSavingChannelId(null),
  })

  const settingsMutation = useMutation({
    mutationFn: async (payload: ProfitSettingsPayload) => {
      const res = await updateProfitSettings(payload)
      if (!res.success) {
        throw new Error(res.message || t('Failed to update ledger settings'))
      }
      return payload
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profit', 'stats'] })
    },
    onError: (error) => handleServerError(error),
  })

  const allRows = useMemo(
    () => statsQuery.data?.rows ?? [],
    [statsQuery.data]
  )
  // 服务端数据刷新后以服务端顺序为准
  useEffect(() => {
    setLocalOrder(null)
  }, [statsQuery.data])

  const orderedRows = useMemo(
    () => (localOrder ? sortRowsByOrder(allRows, localOrder) : allRows),
    [allRows, localOrder]
  )
  const hiddenCount = useMemo(
    () => allRows.filter((row) => row.hidden).length,
    [allRows]
  )
  const rows = useMemo(
    () => (showHidden ? orderedRows : orderedRows.filter((row) => !row.hidden)),
    [orderedRows, showHidden]
  )
  const groups = useMemo(() => collectProfitGroups(allRows), [allRows])
  const filteredRows = useMemo(
    () => filterProfitRows(rows, { search, status, group }),
    [rows, search, status, group]
  )
  const visibleRows = useMemo(
    () => filteredRows.filter((row) => !row.hidden),
    [filteredRows]
  )

  const handleReorder = (dragKey: string, targetKey: string) => {
    const currentOrder = orderedRows.map((row) => row.key)
    const nextOrder = moveRowKey(currentOrder, dragKey, targetKey)
    if (nextOrder === currentOrder) return
    setLocalOrder(nextOrder)
    settingsMutation.mutate({ row_order: nextOrder })
  }

  const handleHide = (row: ChannelProfitRow) => {
    const hiddenRows = statsQuery.data?.hidden_rows ?? []
    settingsMutation.mutate(
      { hidden_rows: [...hiddenRows, row.key] },
      { onSuccess: () => toast.success(t('Removed from the ledger')) }
    )
    setHideConfirmOpen(false)
  }

  const requestHide = (row: ChannelProfitRow) => {
    setPendingHideRow(row)
    setHideConfirmOpen(true)
  }

  const handleRestore = (row: ChannelProfitRow) => {
    const hiddenRows = statsQuery.data?.hidden_rows ?? []
    settingsMutation.mutate(
      { hidden_rows: hiddenRows.filter((key) => key !== row.key) },
      { onSuccess: () => toast.success(t('Restored to the ledger')) }
    )
  }

  const handleRestartStats = () => {
    settingsMutation.mutate(
      { stats_start_at: 0 },
      { onSuccess: () => toast.success(t('Ledger now starts from this moment')) }
    )
    setRestartConfirmOpen(false)
  }

  const statsStartAt = statsQuery.data?.stats_start_at ?? 0

  const handleExport = () => {
    const csv = buildProfitCsv(visibleRows, {
      headers: [
        t('Channel ID'),
        t('Channel Name'),
        t('Group'),
        t('Upstream Ratio'),
        t('Sell Ratio'),
        t('Requests'),
        t('Revenue'),
        t('Upstream Cost'),
        t('Realtime Profit'),
        t('Profit Margin'),
        t('Last Used'),
      ],
      formatAmount: (quota) =>
        formatQuotaWithCurrency(quota, { abbreviate: false }),
      formatTime: (timestamp) =>
        formatDateTimeObject(new Date(timestamp * 1000)),
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `profit-${dayjs(range.start).format('YYYYMMDD')}-${dayjs(range.end).format('YYYYMMDD')}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const tableFilters = (
    <div className='flex flex-wrap items-center gap-2'>
      <div className='relative'>
        <Search
          aria-hidden='true'
          className='text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2'
        />
        <Input
          type='search'
          aria-label={t('Search channel name')}
          placeholder={t('Search channel name')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className='h-7 w-40 pl-7 text-sm'
        />
      </div>
      <NativeSelect
        size='sm'
        aria-label={t('Channel status')}
        value={status}
        onChange={(event) =>
          setStatus(event.target.value as ProfitStatusFilter)
        }
      >
        <NativeSelectOption value='all'>{t('All Status')}</NativeSelectOption>
        <NativeSelectOption value='enabled'>{t('Enabled')}</NativeSelectOption>
        <NativeSelectOption value='disabled'>{t('Disabled')}</NativeSelectOption>
      </NativeSelect>
      <NativeSelect
        size='sm'
        aria-label={t('Group')}
        value={group}
        onChange={(event) => setGroup(event.target.value)}
      >
        <NativeSelectOption value={ALL_GROUPS_FILTER}>
          {t('All Groups')}
        </NativeSelectOption>
        {groups.map((item) => (
          <NativeSelectOption key={item} value={item}>
            {item}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {hiddenCount > 0 && (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          aria-pressed={showHidden}
          onClick={() => setShowHidden((value) => !value)}
        >
          {showHidden ? <EyeOff aria-hidden='true' /> : <Eye aria-hidden='true' />}
          {showHidden
            ? t('Hide removed rows')
            : t('Show removed rows ({{count}})', { count: hiddenCount })}
        </Button>
      )}
    </div>
  )

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        <span className='inline-flex items-center gap-2'>
          {t('Profit & Expense')}
          <Badge variant='secondary'>
            <Lock aria-hidden='true' />
            {t('Admins only')}
          </Badge>
        </span>
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <CompactDateTimeRangePicker
          start={range.start}
          end={range.end}
          className='w-auto min-w-52'
          onChange={(next) => {
            if (!next.start || !next.end) return
            setRange({ start: next.start, end: next.end })
          }}
        />
        <Button
          type='button'
          variant='outline'
          onClick={() => void statsQuery.refetch()}
          disabled={statsQuery.isFetching}
        >
          <RefreshCw
            aria-hidden='true'
            className={cn(statsQuery.isFetching && 'animate-spin')}
          />
          {t('Refresh')}
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={handleExport}
          disabled={visibleRows.length === 0}
        >
          <Download aria-hidden='true' />
          {t('Export')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='space-y-3 sm:space-y-4'>
          <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm'>
            <span>
              {t(
                'Realtime cost, sell ratio and profit of every channel, calculated from usage logs.'
              )}
            </span>
            {statsStartAt > 0 && (
              <span className='inline-flex items-center gap-1'>
                <TimerReset className='size-3.5' aria-hidden='true' />
                {t('Counting since {{time}}; earlier usage is ignored.', {
                  time: formatDateTimeObject(new Date(statsStartAt * 1000)),
                })}
                <Button
                  type='button'
                  variant='link'
                  size='xs'
                  className='h-auto px-1'
                  onClick={() => setRestartConfirmOpen(true)}
                >
                  {t('Restart from now')}
                </Button>
              </span>
            )}
          </div>
          <FadeIn>
            <ProfitSummaryCards
              summary={statsQuery.data?.summary}
              loading={statsQuery.isLoading}
            />
          </FadeIn>
          <FadeIn delay={0.05}>
            <div className='grid gap-3 sm:gap-4 xl:grid-cols-4'>
              <PanelWrapper
                title={t('Channel Profit Details')}
                description={t(
                  'A channel in several groups is listed once per group.'
                )}
                headerActions={tableFilters}
                loading={statsQuery.isLoading}
                className='xl:col-span-3'
                contentClassName='p-0'
              >
                <ProfitTable
                  rows={filteredRows}
                  savingChannelId={savingChannelId}
                  onUpstreamRatioChange={async (channelId, ratio) => {
                    await ratioMutation.mutateAsync({
                      channel_id: channelId,
                      ratio,
                    })
                  }}
                  onReorder={handleReorder}
                  onHide={requestHide}
                  onRestore={handleRestore}
                />
              </PanelWrapper>
              <ProfitFormulaPanel />
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className='grid gap-3 sm:gap-4 xl:grid-cols-2'>
              <ProfitChannelChart
                rows={visibleRows}
                loading={statsQuery.isLoading}
              />
              <ProfitTrendChart
                trend={statsQuery.data?.trend ?? []}
                loading={statsQuery.isLoading}
              />
            </div>
          </FadeIn>
        </div>
        <ConfirmDialog
          open={hideConfirmOpen}
          onOpenChange={setHideConfirmOpen}
          title={t('Remove from the ledger?')}
          desc={t(
            'Channel {{name}} ({{group}}) will be hidden from this page and excluded from the totals. The channel itself is not deleted and you can restore the row at any time.',
            {
              name: pendingHideRow?.channel_name ?? '',
              group: pendingHideRow?.group ?? '',
            }
          )}
          confirmText={t('Remove')}
          destructive
          isLoading={settingsMutation.isPending}
          handleConfirm={() => {
            if (pendingHideRow) handleHide(pendingHideRow)
          }}
        />
        <ConfirmDialog
          open={restartConfirmOpen}
          onOpenChange={setRestartConfirmOpen}
          title={t('Restart the ledger from now?')}
          desc={t(
            'Usage recorded before this moment will no longer be counted on this page. Logs are kept and this only changes the statistics start time.'
          )}
          confirmText={t('Restart from now')}
          isLoading={settingsMutation.isPending}
          handleConfirm={handleRestartStats}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
