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
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  FilterX,
  History,
  RefreshCw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateTimeObject } from '@/lib/time'
import { cn } from '@/lib/utils'

import { QUALITY_TEST_PAGE_SIZE } from '../api'
import { QUALITY_TEST_BUILTIN_PRESETS } from '../constants'
import {
  formatQualityTestEffort,
  formatQualityTestSeconds,
} from '../lib/quality-test'
import type { QualityTestJobsFilter, QualityTestJobsPage } from '../types'
import {
  QualityTestPresetLabel,
  QualityTestStatusBadge,
} from './quality-test-badges'

type RecordsPanelProps = {
  data: QualityTestJobsPage | undefined
  loading: boolean
  fetching: boolean
  page: number
  filter: QualityTestJobsFilter
  selectedId?: number
  onPageChange: (page: number) => void
  onFilterChange: (filter: QualityTestJobsFilter) => void
  onRefresh: () => void
  onOpen: (id: number) => void
}

export function RecordsPanel(props: RecordsPanelProps) {
  const { t } = useTranslation()
  const facets = props.data?.facets
  const jobs = props.data?.jobs ?? []
  const total = props.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / QUALITY_TEST_PAGE_SIZE))
  const filterActive = Object.values(props.filter).some(Boolean)
  const update = (patch: QualityTestJobsFilter) =>
    props.onFilterChange({ ...props.filter, ...patch })

  let emptyTitle = t('No test records yet')
  let emptyHint = t('Results of every run are kept here for comparison.')
  if (props.loading) {
    emptyTitle = t('Loading records...')
  } else if (filterActive) {
    emptyTitle = t('No records match the filters')
    emptyHint = t('Try clearing some filters.')
  }

  return (
    <section
      aria-labelledby='quality-records-title'
      className='flex flex-col gap-4'
    >
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h3 id='quality-records-title' className='text-sm font-semibold'>
            {t('Test records')}
          </h3>
          <p className='text-muted-foreground text-xs'>
            {t('Click a row to view the generated animation and run details.')}
          </p>
        </div>
        <div className='flex items-center gap-2'>
          {total > 0 && <Badge variant='secondary'>{total}</Badge>}
          <Button variant='outline' size='sm' onClick={props.onRefresh}>
            <RefreshCw
              aria-hidden='true'
              className={cn(props.fetching && 'animate-spin')}
            />
            {t('Refresh')}
          </Button>
        </div>
      </div>

      <div
        role='group'
        aria-label={t('Filter records')}
        className='flex flex-wrap items-center gap-2'
      >
        <span className='text-muted-foreground inline-flex items-center gap-1 text-xs'>
          <Filter aria-hidden='true' className='size-3.5' />
          {t('Filter')}
        </span>
        <NativeSelect
          size='sm'
          aria-label={t('Group')}
          value={props.filter.group ?? ''}
          onChange={(event) =>
            update({ group: event.target.value || undefined })
          }
        >
          <NativeSelectOption value=''>{t('All Groups')}</NativeSelectOption>
          {facets?.groups.map((item) => (
            <NativeSelectOption key={item} value={item}>
              {item}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          size='sm'
          aria-label={t('Channel')}
          value={props.filter.channel_id ? String(props.filter.channel_id) : ''}
          onChange={(event) =>
            update({ channel_id: Number(event.target.value) || undefined })
          }
        >
          <NativeSelectOption value=''>{t('All channels')}</NativeSelectOption>
          {facets?.channels.map((item) => (
            <NativeSelectOption key={item.id} value={String(item.id)}>
              {`${item.name} · #${item.id}`}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          size='sm'
          aria-label={t('Model')}
          value={props.filter.model ?? ''}
          onChange={(event) =>
            update({ model: event.target.value || undefined })
          }
        >
          <NativeSelectOption value=''>{t('All models')}</NativeSelectOption>
          {facets?.models.map((item) => (
            <NativeSelectOption key={item} value={item}>
              {item}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          size='sm'
          aria-label={t('Reasoning effort')}
          value={props.filter.effort ?? ''}
          onChange={(event) =>
            update({ effort: event.target.value || undefined })
          }
        >
          <NativeSelectOption value=''>{t('All efforts')}</NativeSelectOption>
          {facets?.efforts.map((item) => (
            <NativeSelectOption
              key={item || 'default'}
              value={item || 'default'}
            >
              {formatQualityTestEffort(t, item)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          size='sm'
          aria-label={t('Prompt preset')}
          value={props.filter.preset ?? ''}
          onChange={(event) =>
            update({ preset: event.target.value || undefined })
          }
        >
          <NativeSelectOption value=''>{t('All presets')}</NativeSelectOption>
          <NativeSelectOption value='none'>
            {t('Hand-typed')}
          </NativeSelectOption>
          {facets?.presets.map((item) => {
            const builtin = QUALITY_TEST_BUILTIN_PRESETS.find(
              (preset) => preset.key === item.ref
            )
            const label =
              item.kind === 'builtin' && builtin
                ? t(builtin.nameKey)
                : item.name || item.ref
            return (
              <NativeSelectOption
                key={`${item.kind}:${item.ref}`}
                value={`${item.kind}:${item.ref}`}
              >
                {label}
              </NativeSelectOption>
            )
          })}
        </NativeSelect>
        {filterActive && (
          <Button
            size='sm'
            variant='ghost'
            onClick={() => props.onFilterChange({})}
          >
            <FilterX aria-hidden='true' />
            {t('Clear filters')}
          </Button>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className='text-muted-foreground flex min-h-60 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center'>
          <History aria-hidden='true' className='size-9' />
          <h4 className='text-foreground text-sm font-medium'>{emptyTitle}</h4>
          <p className='text-xs'>{emptyHint}</p>
        </div>
      ) : (
        <div className='bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ID')}</TableHead>
                <TableHead>{t('Channel')}</TableHead>
                <TableHead>{t('Group')}</TableHead>
                <TableHead>{t('Model')}</TableHead>
                <TableHead>{t('Reasoning effort')}</TableHead>
                <TableHead>{t('Prompt preset')}</TableHead>
                <TableHead>{t('Test time')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead className='text-right'>{t('Duration')}</TableHead>
                <TableHead
                  className='text-right'
                  title={t('Time from submission to the first answer token')}
                >
                  {t('First content')}
                </TableHead>
                <TableHead className='text-right'>
                  {t('Output tokens')}
                </TableHead>
                <TableHead>
                  <span className='sr-only'>{t('View result')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow
                  key={job.id}
                  data-state={
                    props.selectedId === job.id ? 'selected' : undefined
                  }
                  className='cursor-pointer'
                  onClick={() => props.onOpen(job.id)}
                >
                  <TableCell className='font-mono text-xs'>#{job.id}</TableCell>
                  <TableCell>
                    <div className='flex max-w-48 flex-col'>
                      <span className='truncate' title={job.channel_name}>
                        {job.channel_name}
                      </span>
                      <small className='text-muted-foreground font-mono'>
                        #{job.channel_id}
                      </small>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant='outline'>{job.group}</Badge>
                  </TableCell>
                  <TableCell className='font-mono text-xs'>
                    {job.model}
                  </TableCell>
                  <TableCell className='text-xs'>
                    {formatQualityTestEffort(t, job.reasoning_effort)}
                  </TableCell>
                  <TableCell>
                    <QualityTestPresetLabel job={job} />
                  </TableCell>
                  <TableCell className='text-xs whitespace-nowrap'>
                    {formatDateTimeObject(new Date(job.created_at * 1000))}
                  </TableCell>
                  <TableCell>
                    <QualityTestStatusBadge status={job.status} pill />
                  </TableCell>
                  <TableCell className='text-right font-mono text-xs'>
                    {formatQualityTestSeconds(job.duration_ms)}
                  </TableCell>
                  <TableCell className='text-right font-mono text-xs'>
                    {formatQualityTestSeconds(job.first_content_ms)}
                  </TableCell>
                  <TableCell className='text-right font-mono text-xs'>
                    {job.output_tokens?.toLocaleString() ?? '—'}
                  </TableCell>
                  <TableCell className='text-right'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={(event) => {
                        event.stopPropagation()
                        props.onOpen(job.id)
                      }}
                    >
                      <Eye aria-hidden='true' />
                      {t('View result')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {total > QUALITY_TEST_PAGE_SIZE && (
        <div className='flex items-center justify-end gap-2 text-xs'>
          <span className='text-muted-foreground'>
            {t('Page {{page}} of {{total}}', {
              page: props.page,
              total: totalPages,
            })}
          </span>
          <Button
            size='icon-sm'
            variant='outline'
            aria-label={t('Previous page')}
            disabled={props.page <= 1}
            onClick={() => props.onPageChange(props.page - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            size='icon-sm'
            variant='outline'
            aria-label={t('Next page')}
            disabled={props.page >= totalPages}
            onClick={() => props.onPageChange(props.page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </section>
  )
}
