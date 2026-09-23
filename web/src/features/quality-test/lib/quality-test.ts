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
import type { TFunction } from 'i18next'

import {
  QUALITY_TEST_BUILTIN_PRESETS,
  QUALITY_TEST_EFFORT_LABELS,
} from '../constants'
import type { QualityTestJob, QualityTestPrompt } from '../types'

export function isQualityTestActive(
  job?: Pick<QualityTestJob, 'status'> | null
): boolean {
  return job?.status === 'running' || job?.status === 'cancelling'
}

/**
 * 从模型回复中提取可渲染的 HTML：支持完整文档、Markdown 代码块包裹的 HTML
 * 以及独立的 SVG/片段。原始回复永远不会插入后台页面 DOM。
 */
export function extractQualityTestHTML(output: string): string {
  const blocks = [
    ...output.matchAll(/```(?:html|svg|xml)?[^\S\r\n]*\r?\n([\s\S]*?)```/gi),
  ]
  const candidate =
    blocks.find((block) =>
      /<!doctype\s+html|<html[\s>]/i.test(block[1])
    )?.[1] ??
    blocks.find((block) =>
      /<(?:svg|div|style|main|body)[\s>]/i.test(block[1])
    )?.[1] ??
    output
      .replace(/^\s*```(?:html|svg|xml)?\s*\r?\n/i, '')
      .replace(/\s*```\s*$/, '')
  const start = candidate.search(
    /<!doctype\s+html|<html[\s>]|<(?:svg|div|style|main|body|section|canvas)[\s>]/i
  )
  if (start < 0) return ''
  const html = candidate.slice(start).trim()
  const end = html.toLowerCase().lastIndexOf('</html>')
  return end >= 0 ? html.slice(0, end + 7) : html
}

/**
 * 上报渲染后的内容高度，宿主据此调整 iframe 高度。只在宽度变化时重新测量，
 * 避免与视口相关布局形成循环；数值不可信，由宿主夹取。
 */
const QUALITY_TEST_SIZE_SCRIPT = `<script>(function(){var w=innerWidth;function m(){var d=document.documentElement,b=document.body;parent.postMessage({type:'quality-test-preview-size',width:innerWidth,height:Math.max(d?d.scrollHeight:0,b?b.scrollHeight:0)},'*')}addEventListener('load',m);setTimeout(m,400);setTimeout(m,1200);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(m);addEventListener('resize',function(){if(innerWidth!==w){w=innerWidth;m()}})})()</script>`

/**
 * 在生成内容之前写入 CSP：允许内联动画，禁止网络请求、外部资源、表单、Worker 与嵌套 frame。
 * iframe 另外必须使用 sandbox="allow-scripts"（不得 allow-same-origin）。
 */
export function qualityTestPreviewDocument(
  html: string,
  exportScript = ''
): string {
  const policy =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;min-height:100%;}svg{max-width:100%;}</style></head><body>${html}${QUALITY_TEST_SIZE_SCRIPT}${exportScript}</body></html>`
}

export const QUALITY_TEST_FRAME_MIN = 320
export const QUALITY_TEST_FRAME_MAX = 1400

export function clampQualityTestFrameHeight(
  value: unknown
): number | undefined {
  const height = Number(value)
  if (!Number.isFinite(height) || height <= 0) return undefined
  return Math.round(
    Math.min(QUALITY_TEST_FRAME_MAX, Math.max(QUALITY_TEST_FRAME_MIN, height))
  )
}

export type QualityTestPresetMatch =
  | { kind: 'custom'; preset: QualityTestPrompt }
  | { kind: 'builtin'; key: string; nameKey: string }
  | { kind: 'none' }

/**
 * 当前提示词对应哪条预设由文本推导：文本改动后即视为手写提示词，
 * 不额外维护选中状态。自定义预设优先于内置预设。
 */
export function matchQualityTestPreset(
  prompt: string,
  presets: QualityTestPrompt[]
): QualityTestPresetMatch {
  const custom = presets.find((item) => item.prompt === prompt)
  if (custom) return { kind: 'custom', preset: custom }
  const builtin = QUALITY_TEST_BUILTIN_PRESETS.find(
    (item) => item.prompt === prompt
  )
  if (builtin) {
    return { kind: 'builtin', key: builtin.key, nameKey: builtin.nameKey }
  }
  return { kind: 'none' }
}

export function formatQualityTestSeconds(ms?: number | null): string {
  return ms === undefined || ms === null ? '—' : `${(ms / 1000).toFixed(1)} s`
}

/** 思考强度展示为「高 · high」，模型默认值只显示名称 */
export function formatQualityTestEffort(t: TFunction, effort: string): string {
  const label = t(QUALITY_TEST_EFFORT_LABELS[effort] ?? effort)
  return effort ? `${label} · ${effort}` : label
}

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

export function downloadQualityTestFile(
  content: string,
  type: string,
  extension: 'html' | 'svg',
  id?: number
) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = `quality-test-${id ?? Date.now()}.${extension}`
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
