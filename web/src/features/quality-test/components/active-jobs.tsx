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
import { ArrowUpRight, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { QUALITY_TEST_STATUS_LABELS } from '../constants'
import {
  formatQualityTestEffort,
  formatQualityTestSeconds,
} from '../lib/quality-test'
import type { QualityTestJob } from '../types'

type ActiveJobsProps = {
  jobs: QualityTestJob[]
  selectedId?: number
  onSelect: (id: number) => void
}

/** 进行中的后台任务：点击切换到工作台查看实时状态 */
export function ActiveJobs(props: ActiveJobsProps) {
  const { t } = useTranslation()
  if (props.jobs.length === 0) return null
  return (
    <section
      aria-label={t('Running tests')}
      className='bg-card ring-foreground/10 flex flex-col gap-2 rounded-xl p-3 ring-1'
    >
      <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
        <span className='inline-flex items-center gap-1.5 font-medium text-sky-600 dark:text-sky-400'>
          <RefreshCw aria-hidden='true' className='size-3.5 animate-spin' />
          {t('Running tests')}
        </span>
        <p className='text-muted-foreground'>
          {t('Tests keep running on the server after you leave this page.')}
        </p>
      </div>
      <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-3'>
        {props.jobs.map((job) => (
          <button
            key={job.id}
            type='button'
            aria-pressed={props.selectedId === job.id}
            onClick={() => props.onSelect(job.id)}
            className={cn(
              'hover:bg-muted/60 flex flex-col gap-1 rounded-lg border p-2 text-left text-xs transition-colors',
              props.selectedId === job.id && 'border-primary bg-muted/40'
            )}
          >
            <span className='flex items-center justify-between gap-2'>
              <span className='truncate font-medium'>{job.channel_name}</span>
              <span className='text-muted-foreground shrink-0'>
                {job.group}
              </span>
            </span>
            <span className='text-muted-foreground truncate font-mono'>
              {job.model} · {formatQualityTestEffort(t, job.reasoning_effort)}
            </span>
            <span className='text-muted-foreground flex items-center justify-between'>
              <span>
                #{job.id} · {t(QUALITY_TEST_STATUS_LABELS[job.status])}
              </span>
              <span className='inline-flex items-center gap-1'>
                {formatQualityTestSeconds(job.duration_ms)}
                <ArrowUpRight aria-hidden='true' className='size-3.5' />
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
