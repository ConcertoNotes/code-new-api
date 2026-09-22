import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { RefreshCcw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { SettingsSection } from '../components/settings-section'
import {
  getLotteryAdminDraws,
  getLotteryAdminOverview,
  type LotteryAdminOverview,
} from './lottery-admin-api'

const PAGE_SIZE = 20

const formatAmount = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2)

const formatTime = (ts: number) => dayjs.unix(ts).format('MM-DD HH:mm:ss')

function StatTile(props: { label: string; value: string; hint?: string }) {
  return (
    <div className='rounded-lg border p-3'>
      <p className='text-muted-foreground text-xs'>{props.label}</p>
      <p className='mt-1 text-xl font-semibold'>{props.value}</p>
      {props.hint && (
        <p className='text-muted-foreground mt-0.5 text-xs'>{props.hint}</p>
      )}
    </div>
  )
}

function PrizeStockTable(props: { overview: LotteryAdminOverview }) {
  const { t } = useTranslation()
  const remainingTotal = props.overview.prizes.reduce((n, p) => n + p.stock, 0)
  const initialTotal = props.overview.prizes.reduce(
    (n, p) => n + p.initial_stock,
    0
  )
  return (
    <Table aria-label={t('Remaining tickets')}>
      <TableHeader>
        <TableRow>
          <TableHead>{t('Prize')}</TableHead>
          <TableHead className='text-right'>{t('Remaining')}</TableHead>
          <TableHead className='text-right'>{t('Initial stock')}</TableHead>
          <TableHead className='text-right'>{t('Claimed')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.overview.prizes.map((prize) => (
          <TableRow key={prize.id}>
            <TableCell>
              {t('{{amount}} quota', { amount: prize.amount })}
            </TableCell>
            <TableCell className='text-right font-medium'>
              {prize.stock}
            </TableCell>
            <TableCell className='text-right'>{prize.initial_stock}</TableCell>
            <TableCell className='text-right'>
              {prize.initial_stock - prize.stock}
            </TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell className='font-medium'>{t('Total')}</TableCell>
          <TableCell className='text-right font-medium'>
            {remainingTotal}
          </TableCell>
          <TableCell className='text-right'>{initialTotal}</TableCell>
          <TableCell className='text-right'>
            {initialTotal - remainingTotal}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

export function LotteryMonitorSection() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')

  const overview = useQuery({
    queryKey: ['lottery-admin-overview'],
    queryFn: getLotteryAdminOverview,
  })
  const draws = useQuery({
    queryKey: ['lottery-admin-draws', page, appliedKeyword],
    queryFn: () =>
      getLotteryAdminDraws({
        page,
        pageSize: PAGE_SIZE,
        keyword: appliedKeyword,
      }),
  })

  const totalPages = Math.max(
    1,
    Math.ceil((draws.data?.total ?? 0) / PAGE_SIZE)
  )
  const refreshing = overview.isFetching || draws.isFetching

  const applySearch = () => {
    setPage(1)
    setAppliedKeyword(keyword.trim())
  }

  return (
    <SettingsSection title={t('Lottery Monitor')}>
      <div className='flex items-center justify-between'>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Live view of remaining tickets, budget and every winner. Only admins can see this.'
          )}
        </p>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => {
            overview.refetch()
            draws.refetch()
          }}
          disabled={refreshing}
        >
          <RefreshCcw
            className={refreshing ? 'size-4 animate-spin' : 'size-4'}
            aria-hidden='true'
          />
          {t('Refresh')}
        </Button>
      </div>

      {overview.isError && (
        <p role='alert' className='text-destructive text-sm'>
          {t('Failed to load lottery overview')}
        </p>
      )}

      {overview.data && (
        <>
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
            <StatTile
              label={t('Remaining tickets')}
              value={String(
                overview.data.prizes.reduce((n, p) => n + p.stock, 0)
              )}
            />
            <StatTile
              label={t('Budget remaining')}
              value={t('{{amount}} quota', {
                amount: formatAmount(overview.data.budget_remaining),
              })}
              hint={t('Event recharges: {{amount}}', {
                amount: formatAmount(overview.data.total_recharge),
              })}
            />
            <StatTile
              label={t('Issued rewards')}
              value={t('{{amount}} quota', {
                amount: formatAmount(overview.data.issued_amount),
              })}
              hint={t('{{count}} draws', { count: overview.data.draw_count })}
            />
            <StatTile
              label={t('Winners')}
              value={String(overview.data.winner_count)}
            />
          </div>

          <PrizeStockTable overview={overview.data} />

          <h3 className='text-sm font-medium'>{t('Winners leaderboard')}</h3>
          {overview.data.winners.length === 0 ? (
            <p className='text-muted-foreground text-sm'>{t('No draws yet')}</p>
          ) : (
            <Table aria-label={t('Winners leaderboard')}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('User')}</TableHead>
                  <TableHead className='text-right'>{t('Draws')}</TableHead>
                  <TableHead className='text-right'>{t('Total won')}</TableHead>
                  <TableHead className='text-right'>{t('Last draw')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.data.winners.map((winner) => (
                  <TableRow key={winner.user_id}>
                    <TableCell>
                      {winner.username || `#${winner.user_id}`}
                      <span className='text-muted-foreground ml-1 text-xs'>
                        #{winner.user_id}
                      </span>
                    </TableCell>
                    <TableCell className='text-right'>{winner.draws}</TableCell>
                    <TableCell className='text-right font-medium'>
                      {t('{{amount}} quota', {
                        amount: formatAmount(winner.total_amount),
                      })}
                    </TableCell>
                    <TableCell className='text-right'>
                      {formatTime(winner.last_draw_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}

      <h3 className='text-sm font-medium'>{t('All draws')}</h3>
      <div className='flex flex-wrap items-center gap-2'>
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applySearch()
          }}
          placeholder={t('Search by username')}
          aria-label={t('Search by username')}
          className='max-w-xs'
        />
        <Button type='button' variant='outline' size='sm' onClick={applySearch}>
          {t('Search')}
        </Button>
      </div>
      {draws.isError && (
        <p role='alert' className='text-destructive text-sm'>
          {t('Failed to load lottery draws')}
        </p>
      )}
      {draws.data && draws.data.items.length === 0 && (
        <p className='text-muted-foreground text-sm'>{t('No draws yet')}</p>
      )}
      {draws.data && draws.data.items.length > 0 && (
        <Table aria-label={t('All draws')}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Time')}</TableHead>
              <TableHead>{t('User')}</TableHead>
              <TableHead className='text-right'>{t('Prize')}</TableHead>
              <TableHead className='text-right'>
                {t('Stock before draw')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {draws.data.items.map((draw) => (
              <TableRow key={draw.id}>
                <TableCell>{formatTime(draw.created_at)}</TableCell>
                <TableCell>
                  {draw.username || `#${draw.user_id}`}
                  <span className='text-muted-foreground ml-1 text-xs'>
                    #{draw.user_id}
                  </span>
                </TableCell>
                <TableCell className='text-right font-medium'>
                  {t('{{amount}} quota', { amount: formatAmount(draw.amount) })}
                </TableCell>
                <TableCell className='text-muted-foreground text-right text-xs'>
                  {draw.stock_snapshot}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <div className='flex items-center justify-end gap-2 text-sm'>
        <span className='text-muted-foreground'>
          {t('Page {{page}} of {{total}}', { page, total: totalPages })}
        </span>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          {t('Previous')}
        </Button>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          {t('Next')}
        </Button>
      </div>
    </SettingsSection>
  )
}
