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
import { CHANNEL_STATUS } from '@/features/channels/constants'

import type { ChannelProfitRow, ProfitStatusFilter } from '../types'

export type ProfitRowFilters = {
  search: string
  status: ProfitStatusFilter
  group: string
}

export const ALL_GROUPS_FILTER = '__all__'

/** 利润率（百分比）；没有收入时返回 null，避免除零 */
export function computeProfitRate(
  profitQuota: number,
  revenueQuota: number
): number | null {
  if (!Number.isFinite(revenueQuota) || revenueQuota <= 0) return null
  return (profitQuota / revenueQuota) * 100
}

/** 倍率展示：最多保留 4 位小数并去掉多余的 0 */
export function formatRatio(ratio: number): string {
  if (!Number.isFinite(ratio)) return '-'
  return String(Number(ratio.toFixed(4)))
}

/** 浏览器本地时区相对 UTC 的偏移秒数（东八区为 +28800） */
export function getTimezoneOffsetSeconds(now: Date = new Date()): number {
  return -now.getTimezoneOffset() * 60
}

/** 按关键字、渠道状态、分组过滤明细行 */
export function filterProfitRows(
  rows: ChannelProfitRow[],
  filters: ProfitRowFilters
): ChannelProfitRow[] {
  const keyword = filters.search.trim().toLowerCase()
  return rows.filter((row) => {
    if (keyword) {
      const haystack =
        `${row.channel_name} #${row.channel_id} ${row.group}`.toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (filters.status === 'enabled') {
      if (!row.channel_exists) return false
      if (row.channel_status !== CHANNEL_STATUS.ENABLED) return false
    }
    if (filters.status === 'disabled') {
      if (row.channel_exists && row.channel_status === CHANNEL_STATUS.ENABLED) {
        return false
      }
    }
    if (filters.group !== ALL_GROUPS_FILTER && row.group !== filters.group) {
      return false
    }
    return true
  })
}

/** 明细中出现过的分组（去重、按字母排序） */
export function collectProfitGroups(rows: ChannelProfitRow[]): string[] {
  return [...new Set(rows.map((row) => row.group))].sort((a, b) =>
    a.localeCompare(b)
  )
}

/** 按渠道合并多分组的利润，用于渠道利润对比图 */
export function aggregateProfitByChannel(
  rows: ChannelProfitRow[]
): Array<{ channel_id: number; channel_name: string; profit_quota: number }> {
  const byChannel = new Map<
    number,
    { channel_id: number; channel_name: string; profit_quota: number }
  >()
  for (const row of rows) {
    const existing = byChannel.get(row.channel_id)
    if (existing) {
      existing.profit_quota += row.profit_quota
      continue
    }
    byChannel.set(row.channel_id, {
      channel_id: row.channel_id,
      channel_name: row.channel_name,
      profit_quota: row.profit_quota,
    })
  }
  return [...byChannel.values()].sort(
    (a, b) => b.profit_quota - a.profit_quota
  )
}

function escapeCsvCell(value: string | number): string {
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

/** 生成明细 CSV 文本；金额以显示货币的格式化函数转换 */
export function buildProfitCsv(
  rows: ChannelProfitRow[],
  options: {
    headers: string[]
    formatAmount: (quota: number) => string
    formatTime: (timestamp: number) => string
  }
): string {
  const lines = [options.headers.map(escapeCsvCell).join(',')]
  for (const row of rows) {
    const rate = computeProfitRate(row.profit_quota, row.quota)
    lines.push(
      [
        row.channel_id,
        row.channel_name,
        row.group,
        formatRatio(row.upstream_ratio),
        formatRatio(row.sell_ratio),
        row.requests,
        options.formatAmount(row.quota),
        options.formatAmount(row.cost_quota),
        options.formatAmount(row.profit_quota),
        rate == null ? '-' : `${rate.toFixed(1)}%`,
        row.last_used_at > 0 ? options.formatTime(row.last_used_at) : '-',
      ]
        .map(escapeCsvCell)
        .join(',')
    )
  }
  // 使用 CRLF 并加 BOM，保证 Excel 直接打开时中文不乱码
  return `﻿${lines.join('\r\n')}`
}
