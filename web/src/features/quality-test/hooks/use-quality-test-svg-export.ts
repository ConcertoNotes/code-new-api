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
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { qualityTestPreviewDocument } from '../lib/quality-test'
import {
  qualityTestSVGExportScript,
  requestQualityTestSVG,
  validateQualityTestSVG,
} from '../lib/quality-test-svg'

/**
 * 管理预览 iframe 的文档与 SVG 导出桥：预览页在沙箱内截取当前帧的 SVG，
 * 通过 postMessage 回传，父页面再校验后下载。
 */
export function useQualityTestSVGExport(
  html: string,
  generation: string,
  enabled: boolean
) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const pending = useRef<AbortController | null>(null)
  // getRandomValues 在纯 HTTP 部署下同样可用
  const previewID = useMemo(
    () => crypto.getRandomValues(new Uint32Array(4)).join('-'),
    // generation 变化（换任务/重放）时需要新的预览 ID
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [html, generation, enabled]
  )
  const preview = useMemo(
    () =>
      html && enabled
        ? qualityTestPreviewDocument(
            html,
            qualityTestSVGExportScript(previewID)
          )
        : '',
    [html, enabled, previewID]
  )
  const [status, setStatus] = useState<{ previewID: string; hasSVG: boolean }>()
  const [exporting, setExporting] = useState(false)
  const ready = enabled && status?.previewID === previewID
  const hasSVG = ready && status.hasSVG

  // 在提交阶段取消旧请求，避免旧 frame 的回复在新记录出现后才触发下载
  useLayoutEffect(() => {
    setExporting(false)
    const receive = (event: MessageEvent) => {
      if (
        !enabled ||
        event.source !== frameRef.current?.contentWindow ||
        event.data?.type !== 'quality-test-svg-ready' ||
        event.data.previewID !== previewID ||
        typeof event.data.hasSVG !== 'boolean'
      ) {
        return
      }
      setStatus({ previewID, hasSVG: event.data.hasSVG })
    }
    window.addEventListener('message', receive)
    return () => {
      window.removeEventListener('message', receive)
      pending.current?.abort()
      pending.current = null
    }
  }, [previewID, enabled])

  const exportSVG = useCallback(async () => {
    const frame = frameRef.current?.contentWindow
    if (!frame || !ready) throw new Error('notReady')
    if (pending.current) throw new Error('cancelled')
    const controller = new AbortController()
    pending.current = controller
    setExporting(true)
    try {
      const svg = await requestQualityTestSVG(
        frame,
        previewID,
        controller.signal
      )
      if (controller.signal.aborted) throw new Error('cancelled')
      return validateQualityTestSVG(svg)
    } finally {
      if (pending.current === controller) {
        pending.current = null
        setExporting(false)
      }
    }
  }, [previewID, ready])

  return { frameRef, preview, ready, hasSVG, exporting, exportSVG }
}

export type QualityTestSVGExport = ReturnType<typeof useQualityTestSVGExport>
