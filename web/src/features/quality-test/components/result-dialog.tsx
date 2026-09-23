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
import { ExternalLink } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTimeObject } from '@/lib/time'

import { QUALITY_TEST_ENDPOINT_LABELS } from '../constants'
import { useQualityTestJob } from '../hooks/use-quality-test-queries'
import { useQualityTestResultViewer } from '../hooks/use-quality-test-result-viewer'
import {
  formatQualityTestEffort,
  formatQualityTestSeconds,
} from '../lib/quality-test'
import {
  QualityTestPresetLabel,
  QualityTestStatusBadge,
} from './quality-test-badges'
import { PreviewActions, ResultCanvas, ResultViewToggle } from './result-canvas'

type ResultDialogProps = {
  id: number | undefined
  onClose: () => void
  onOpenStudio: (id: number) => void
}

/** 检测记录的结果弹窗：左侧渲染动画，右侧展示渠道、模型、耗时等详情 */
export function ResultDialog(props: ResultDialogProps) {
  const { t } = useTranslation()
  const detail = useQualityTestJob(props.id)
  const run = detail.data ?? null
  const viewer = useQualityTestResultViewer(run, Boolean(props.id))
  const reset = viewer.reset
  useEffect(() => {
    reset()
    // 仅在切换记录时复位视图
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [props.id])

  const effortLabel = run
    ? formatQualityTestEffort(t, run.reasoning_effort)
    : '—'
  const meta: [string, string, string?][] = [
    [t('Channel'), run ? `${run.channel_name} · #${run.channel_id}` : '—'],
    [t('Group'), run?.group ?? '—'],
    [t('Model'), run?.model ?? '—'],
    [t('Reasoning effort'), effortLabel],
    [
      t('Endpoint'),
      run
        ? (QUALITY_TEST_ENDPOINT_LABELS[run.endpoint_type] ?? run.endpoint_type)
        : '—',
    ],
    [
      t('Test time'),
      run ? formatDateTimeObject(new Date(run.created_at * 1000)) : '—',
    ],
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
    <Dialog
      open={Boolean(props.id)}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      <DialogContent className='flex h-[calc(100dvh-1.5rem)] w-[min(1480px,calc(100vw-1.5rem))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none'>
        <DialogHeader className='flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-3 pr-12'>
          <div className='min-w-0'>
            <DialogTitle className='text-sm'>
              {t('Generated result')}
              {props.id ? (
                <span className='text-muted-foreground ml-2 font-mono text-xs'>
                  #{props.id}
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription className='truncate text-xs'>
              {run
                ? `${run.channel_name} · #${run.channel_id} / ${run.model}`
                : t('Loading...')}
            </DialogDescription>
          </div>
          <ResultViewToggle value={viewer.view} onChange={viewer.setView} />
        </DialogHeader>
        <div className='flex min-h-0 flex-1 flex-col lg:flex-row'>
          <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-auto'>
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
          </div>
          <aside className='w-full shrink-0 overflow-auto border-t p-4 lg:w-80 lg:border-t-0 lg:border-l'>
            <div className='mb-4 flex items-center justify-between gap-2'>
              <QualityTestStatusBadge status={run?.status} pill />
              {run?.group ? <Badge variant='outline'>{run.group}</Badge> : null}
            </div>
            <h3 className='mb-2 text-sm font-semibold'>{t('Run details')}</h3>
            <dl className='grid grid-cols-2 gap-x-3 gap-y-3 text-xs'>
              {meta.map(([label, value, hint]) => (
                <div key={label} title={hint} className='min-w-0'>
                  <dt className='text-muted-foreground'>{label}</dt>
                  <dd className='truncate font-mono' title={value}>
                    {value}
                  </dd>
                </div>
              ))}
              <div className='col-span-2'>
                <dt className='text-muted-foreground mb-1'>
                  {t('Prompt preset')}
                </dt>
                <dd>{run ? <QualityTestPresetLabel job={run} /> : '—'}</dd>
              </div>
            </dl>
            {run?.response_model && (
              <p className='text-muted-foreground mt-3 text-xs'>
                {t('Upstream model')}: {run.response_model}
              </p>
            )}
            {run?.prompt && (
              <>
                <h3 className='mt-5 mb-2 text-sm font-semibold'>
                  {t('Test prompt')}
                </h3>
                <p className='bg-muted/50 rounded-lg p-3 text-xs whitespace-pre-wrap'>
                  {run.prompt}
                </p>
              </>
            )}
            {run?.completed_at ? (
              <p className='text-muted-foreground mt-2 text-xs'>
                {t('Finished at')}:{' '}
                {formatDateTimeObject(new Date(run.completed_at * 1000))}
              </p>
            ) : null}
          </aside>
        </div>
        <div className='flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2'>
          <span className='text-muted-foreground text-xs'>
            {t('Isolated preview · inline content only')}
          </span>
          <div className='flex items-center gap-2'>
            <PreviewActions
              run={run}
              html={viewer.html}
              view={viewer.view}
              narrow={viewer.narrow}
              svgExport={viewer.svgExport}
              onToggleNarrow={viewer.toggleNarrow}
              onReplay={viewer.replay}
            />
            <Button
              size='sm'
              variant='outline'
              disabled={!props.id}
              onClick={() => props.id && props.onOpenStudio(props.id)}
            >
              <ExternalLink aria-hidden='true' />
              {t('Open in studio')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
