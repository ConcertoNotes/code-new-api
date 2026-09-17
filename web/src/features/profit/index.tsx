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
import { Download, Lock, RefreshCw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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

import { getChannelProfitStats, updateChannelUpstreamRatio } from './api'
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
} from './lib/profit'
import type { ProfitStatusFilter } from './types'

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

  const rows = useMemo(() => statsQuery.data?.rows ?? [], [statsQuery.data])
  const groups = useMemo(() => collectProfitGroups(rows), [rows])
  const filteredRows = useMemo(
    () => filterProfitRows(rows, { search, status, group }),
    [rows, search, status, group]
  )

  const handleExport = () => {
    const csv = buildProfitCsv(filteredRows, {
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
          disabled={filteredRows.length === 0}
        >
          <Download aria-hidden='true' />
          {t('Export')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='space-y-3 sm:space-y-4'>
          <p className='text-muted-foreground text-xs sm:text-sm'>
            {t(
              'Realtime cost, sell ratio and profit of every channel, calculated from usage logs.'
            )}
          </p>
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
                />
              </PanelWrapper>
              <ProfitFormulaPanel />
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className='grid gap-3 sm:gap-4 xl:grid-cols-2'>
              <ProfitChannelChart
                rows={filteredRows}
                loading={statsQuery.isLoading}
              />
              <ProfitTrendChart
                trend={statsQuery.data?.trend ?? []}
                loading={statsQuery.isLoading}
              />
            </div>
          </FadeIn>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
