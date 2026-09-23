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
import { useMemo, useState } from 'react'

import type { QualityTestResultView } from '../components/result-canvas'
import {
  extractQualityTestHTML,
  isQualityTestActive,
} from '../lib/quality-test'
import type { QualityTestJob } from '../types'
import { useQualityTestSVGExport } from './use-quality-test-svg-export'

/** 结果查看器状态：预览/源码切换、重放、窄屏预览以及 SVG 导出桥 */
export function useQualityTestResultViewer(
  run: QualityTestJob | null,
  enabled: boolean
) {
  const [view, setView] = useState<QualityTestResultView>('preview')
  const [previewKey, setPreviewKey] = useState(0)
  const [narrow, setNarrow] = useState(false)
  // 运行中输出不完整，只在任务结束后渲染预览
  const html = useMemo(
    () =>
      run && !isQualityTestActive(run)
        ? extractQualityTestHTML(run.output ?? '')
        : '',
    [run]
  )
  const svgExport = useQualityTestSVGExport(
    html,
    `${run?.id ?? 0}-${previewKey}`,
    enabled && view === 'preview'
  )
  return {
    view,
    setView,
    previewKey,
    replay: () => setPreviewKey((key) => key + 1),
    narrow,
    toggleNarrow: () => setNarrow((value) => !value),
    reset: () => {
      setView('preview')
      setNarrow(false)
      setPreviewKey((key) => key + 1)
    },
    html,
    svgExport,
  }
}
