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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock3, Square } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { handleServerError } from '@/lib/handle-server-error'
import { formatDateTimeObject } from '@/lib/time'

import { cancelQualityTestJob } from '../api'
import { QUALITY_TEST_REVIEW_CRITERIA } from '../constants'
import {
  qualityTestQueryKeys,
  useQualityTestJob,
} from '../hooks/use-quality-test-queries'
import { useQualityTestResultViewer } from '../hooks/use-quality-test-result-viewer'
import {
  formatQualityTestEffort,
  formatQualityTestSeconds,
  isQualityTestActive,
} from '../lib/quality-test'
import { QualityTestStatusBadge } from './quality-test-badges'
import { PreviewActions, ResultCanvas, ResultViewToggle } from './result-canvas'
import { StepHeading } from './step-heading'

type StudioResultProps = {
  /** 只跟随显式选中或正在运行的任务，不回退到历史第一条 */
  jobId: number | undefined
}

export function StudioResult(props: StudioResultProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const detail = useQualityTestJob(props.jobId)
  const run = detail.data ?? null
  const running = isQualityTestActive(run)
  const viewer = useQualityTestResultViewer(run, true)
  const reset = viewer.reset
  useEffect(() => {
    reset()
    // 仅在切换任务时复位视图
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [props.jobId])

  const cancelMutation = useMutation({
    mutationFn: cancelQualityTestJob,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: qualityTestQueryKeys.jobs(),
      })
    },
    onError: handleServerError,
  })

  const metrics: [string, string, string?][] = [
    [t('Duration'), run ? formatQualityTestSeconds(run.duration_ms) : '—'],
    [
      t('First content'),
      formatQualityTestSeconds(run?.first_content_ms),
      t('Time from submission to the first answer token'),
    ],
    [t('Output tokens'), run?.output_tokens?.toLocaleString() ?? '—'],
    [t('Reasoning tokens'), run?.reasoning_tokens?.toLocaleString() ?? '—'],
  ]

  return (
    <section
      aria-labelledby='quality-result-title'
      className='bg-card ring-foreground/10 flex min-w-0 flex-col overflow-hidden rounded-xl ring-1'
    >
      <div className='flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3'>
        <StepHeading
          id='quality-result-title'
          step='02'
          title={t('Generated result')}
        />
        <ResultViewToggle value={viewer.view} onChange={viewer.setView} />
      </div>
      <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-xs'>
        <QualityTestStatusBadge status={run?.status} />
        <span className='truncate'>
          {run
            ? `${run.channel_name} · #${run.channel_id} / ${run.model} / ${formatQualityTestEffort(t, run.reasoning_effort)}`
            : t('Waiting for the next inspiration and reasoning')}
        </span>
        {run && (
          <>
            <span className='inline-flex items-center gap-1'>
              <Clock3 aria-hidden='true' className='size-3.5' />
              {formatDateTimeObject(new Date(run.created_at * 1000))}
            </span>
            <Badge variant='outline'>{run.group}</Badge>
            <span className='font-mono'>#{run.id}</span>
          </>
        )}
        {run && running && (
          <Button
            size='sm'
            variant='outline'
            className='ml-auto'
            disabled={cancelMutation.isPending || run.status === 'cancelling'}
            onClick={() => cancelMutation.mutate(run.id)}
          >
            <Square aria-hidden='true' />
            {run.status === 'cancelling' ? t('Stopping') : t('Stop')}
          </Button>
        )}
      </div>
      {(detail.error || run?.error) && (
        <div
          role='alert'
          className='text-destructive bg-destructive/10 px-4 py-2 text-sm'
        >
          {detail.error?.message ?? run?.error}
        </div>
      )}
      <ResultCanvas
        run={run}
        view={viewer.view}
        html={viewer.html}
        svgExport={viewer.svgExport}
        previewKey={viewer.previewKey}
        narrow={viewer.narrow}
        loading={detail.isLoading}
      />
      <div className='flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2'>
        <span className='text-muted-foreground text-xs'>
          {t('Isolated preview · inline content only')}
        </span>
        <PreviewActions
          run={run}
          html={viewer.html}
          view={viewer.view}
          narrow={viewer.narrow}
          svgExport={viewer.svgExport}
          onToggleNarrow={viewer.toggleNarrow}
          onReplay={viewer.replay}
        />
      </div>
      <dl className='grid grid-cols-2 border-t sm:grid-cols-4'>
        {metrics.map(([label, value, hint]) => (
          <div
            key={label}
            title={hint}
            className='border-r px-4 py-3 last:border-r-0'
          >
            <dt className='text-muted-foreground text-xs'>{label}</dt>
            <dd className='font-mono text-sm font-medium'>{value}</dd>
          </div>
        ))}
      </dl>
      {run?.response_model && (
        <p className='text-muted-foreground border-t px-4 py-2 text-xs'>
          {t('Upstream model')}: {run.response_model}
        </p>
      )}
      {run?.prompt && (
        <details className='border-t px-4 py-2 text-xs'>
          <summary className='cursor-pointer font-medium'>
            {t('Test prompt')}
          </summary>
          <p className='bg-muted/50 mt-2 rounded-lg p-3 whitespace-pre-wrap'>
            {run.prompt}
          </p>
        </details>
      )}
    </section>
  )
}

/** 评判建议：同一提示词多次测试后比较，单次结果只能作为观察依据 */
export function StudioReviewGuide() {
  const { t } = useTranslation()
  return (
    <section className='bg-card ring-foreground/10 grid gap-3 rounded-xl p-4 ring-1 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]'>
      <div>
        <h3 className='text-sm font-semibold'>{t('How to judge')}</h3>
        <p className='text-muted-foreground mt-1 text-xs'>
          {t(
            'Keep the same prompt and compare several runs. A single animation is only an observation and cannot prove a model has been degraded.'
          )}
        </p>
      </div>
      <ul className='grid gap-2 sm:grid-cols-2'>
        {QUALITY_TEST_REVIEW_CRITERIA.map((item, index) => (
          <li
            key={item}
            className='bg-muted/40 flex gap-2 rounded-lg p-2 text-xs'
          >
            <span className='text-muted-foreground font-mono'>
              0{index + 1}
            </span>
            {t(item)}
          </li>
        ))}
      </ul>
    </section>
  )
}
