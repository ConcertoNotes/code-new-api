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
  Code2,
  Copy,
  Download,
  Eye,
  FileImage,
  Gauge,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { CodeBlock } from '@/components/ai-elements/code-block'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import type { QualityTestSVGExport } from '../hooks/use-quality-test-svg-export'
import {
  clampQualityTestFrameHeight,
  downloadQualityTestFile,
  isQualityTestActive,
} from '../lib/quality-test'
import type { QualityTestJob } from '../types'

export type QualityTestResultView = 'preview' | 'source'

type ResultViewToggleProps = {
  value: QualityTestResultView
  onChange: (value: QualityTestResultView) => void
}

export function ResultViewToggle(props: ResultViewToggleProps) {
  const { t } = useTranslation()
  return (
    <Tabs
      value={props.value}
      onValueChange={(value) => props.onChange(value as QualityTestResultView)}
    >
      <TabsList aria-label={t('Result view')}>
        <TabsTrigger value='preview'>
          <Eye aria-hidden='true' />
          {t('Animation preview')}
        </TabsTrigger>
        <TabsTrigger value='source'>
          <Code2 aria-hidden='true' />
          {t('HTML source')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

// 超过该体积的源码不做高亮，避免阻塞主线程
const HIGHLIGHT_LIMIT = 200 * 1024

type ResultCanvasProps = {
  run: QualityTestJob | null
  view: QualityTestResultView
  html: string
  svgExport: QualityTestSVGExport
  previewKey: number
  narrow: boolean
  loading?: boolean
}

/** 结果画布：工作台与记录弹窗共用；预览 iframe 加载隔离页并通过 postMessage 注入 HTML */
export function ResultCanvas(props: ResultCanvasProps) {
  const { t } = useTranslation()
  const frameRef = props.svgExport.frameRef
  // 预览页回传内容高度，画布随内容伸缩；换任务或重放时回到默认高度
  const [frameHeight, setFrameHeight] = useState<number>()
  const runID = props.run?.id
  useEffect(() => {
    setFrameHeight(undefined)
  }, [runID, props.previewKey])
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        !frameRef.current ||
        event.source !== frameRef.current.contentWindow ||
        event.data?.type !== 'quality-test-preview-size'
      ) {
        return
      }
      const height = clampQualityTestFrameHeight(event.data.height)
      if (height !== undefined) {
        setFrameHeight((current) => (current === height ? current : height))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [frameRef])

  const running = isQualityTestActive(props.run)
  let body
  if (props.loading && !props.run) {
    body = (
      <div className='flex min-h-80 flex-1 items-center justify-center'>
        <Loader2 className='text-muted-foreground size-6 animate-spin' />
      </div>
    )
  } else if (props.view === 'source') {
    const source = props.html || props.run?.output || ''
    body = source ? (
      <CodeBlock
        code={source}
        language={source.length <= HIGHLIGHT_LIMIT ? 'html' : 'text'}
        enableCollapse={false}
        showLineNumbers
        className='min-h-80 flex-1 rounded-none border-0'
      />
    ) : (
      <p className='text-muted-foreground flex min-h-80 flex-1 items-center justify-center text-sm'>
        {t('No output yet')}
      </p>
    )
  } else if (props.svgExport.preview) {
    body = (
      <iframe
        ref={frameRef}
        key={`${props.run?.id}-${props.previewKey}`}
        title={t('Animation preview')}
        src='/api/quality_test/preview'
        sandbox='allow-scripts'
        referrerPolicy='no-referrer'
        onLoad={(event) =>
          event.currentTarget.contentWindow?.postMessage(
            { type: 'quality-test-preview', html: props.svgExport.preview },
            '*'
          )
        }
        className={cn(
          'mx-auto block min-h-80 w-full flex-1 border-0 bg-white',
          props.narrow && 'max-w-[390px] border-x'
        )}
        style={frameHeight === undefined ? undefined : { height: frameHeight }}
      />
    )
  } else {
    let title = t('No results yet.')
    let hint = t(
      'Pick a group, channel, model and prompt to start. The generated page renders here in real time.'
    )
    if (running) {
      title = t('Generating...')
      hint = t(
        'The model is writing the page. The preview renders once generation finishes.'
      )
    } else if (props.run) {
      title = t('No renderable HTML')
      hint = t(
        'The reply did not contain an HTML or SVG document. Check the source view.'
      )
    }
    body = (
      <div className='flex min-h-80 flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center'>
        <div className='bg-muted/70 text-primary relative flex size-24 items-center justify-center rounded-full'>
          <Gauge aria-hidden='true' strokeWidth={1.2} className='size-14' />
          <span className='bg-background text-muted-foreground absolute -top-1 -right-3 rotate-12 rounded border px-1.5 font-mono text-[10px]'>
            HTML
          </span>
        </div>
        <span className='text-muted-foreground rounded border px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase'>
          Quality Bench
        </span>
        <h4 className='text-lg font-semibold'>{title}</h4>
        <p className='text-muted-foreground max-w-sm text-sm'>{hint}</p>
        {running && (
          <div className='bg-muted h-1 w-40 overflow-hidden rounded-full'>
            <span className='bg-primary block h-full w-1/3 animate-pulse rounded-full' />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className='bg-muted/30 flex min-h-80 flex-1 flex-col overflow-auto'>
      {body}
    </div>
  )
}

type PreviewActionsProps = {
  run: QualityTestJob | null
  html: string
  view: QualityTestResultView
  narrow: boolean
  svgExport: QualityTestSVGExport
  onToggleNarrow: () => void
  onReplay: () => void
}

const SVG_ERROR_MESSAGES: Record<string, string> = {
  timeout: 'Timed out while exporting the SVG',
  noSVG: 'No visible SVG found in the preview',
  unsupported: 'This SVG uses features that cannot be exported',
  tooLarge: 'The SVG is too large to export',
  notReady: 'The preview is not ready yet',
  failed: 'Failed to export the SVG',
}

export function PreviewActions(props: PreviewActionsProps) {
  const { t } = useTranslation()
  const svg = props.svgExport

  let svgTitle = t('Download current frame as SVG')
  if (svg.exporting) svgTitle = t('Exporting SVG...')
  else if (props.view !== 'preview') {
    svgTitle = t('Switch to the preview to export SVG')
  } else if (!svg.ready) svgTitle = t('Preparing the preview...')
  else if (!svg.hasSVG) svgTitle = t('No SVG in this page')

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(props.html || props.run?.output || '')
      toast.success(t('Copied to clipboard'))
    } catch {
      toast.error(t('Copy failed'))
    }
  }

  const downloadSVG = async () => {
    try {
      const content = await svg.exportSVG()
      downloadQualityTestFile(
        content,
        'image/svg+xml;charset=utf-8',
        'svg',
        props.run?.id
      )
    } catch (error) {
      const code = error instanceof Error ? error.message : 'failed'
      if (code === 'cancelled') return
      toast.error(t(SVG_ERROR_MESSAGES[code] ?? SVG_ERROR_MESSAGES.failed))
    }
  }

  return (
    <div className='flex items-center gap-1'>
      <Button
        size='sm'
        variant='ghost'
        disabled={!props.html || props.view !== 'preview'}
        aria-pressed={props.narrow}
        title={t('Toggle mobile width')}
        onClick={props.onToggleNarrow}
      >
        {props.narrow ? '100%' : '390px'}
      </Button>
      <Button
        size='icon-sm'
        variant='ghost'
        title={t('Replay animation')}
        aria-label={t('Replay animation')}
        disabled={!props.html}
        onClick={props.onReplay}
      >
        <RotateCcw />
      </Button>
      <Button
        size='icon-sm'
        variant='ghost'
        title={t('Copy source')}
        aria-label={t('Copy source')}
        disabled={!props.run?.output}
        onClick={() => void copySource()}
      >
        <Copy />
      </Button>
      <Button
        size='icon-sm'
        variant='ghost'
        title={t('Download HTML')}
        aria-label={t('Download HTML')}
        disabled={!props.html}
        onClick={() =>
          downloadQualityTestFile(
            props.html,
            'text/html;charset=utf-8',
            'html',
            props.run?.id
          )
        }
      >
        <Download />
      </Button>
      <span title={svgTitle}>
        <Button
          size='icon-sm'
          variant='ghost'
          aria-label={svgTitle}
          aria-busy={svg.exporting}
          disabled={!svg.hasSVG || svg.exporting}
          onClick={() => void downloadSVG()}
        >
          {svg.exporting ? <Loader2 className='animate-spin' /> : <FileImage />}
        </Button>
      </span>
    </div>
  )
}
