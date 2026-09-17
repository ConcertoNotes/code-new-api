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
import { api } from '@/lib/api'

import type { ChannelProfitStats, ProfitSettingsPayload } from './types'

/** 获取各渠道 × 分组的实时收支统计（仅管理员） */
export async function getChannelProfitStats(params: {
  start_timestamp: number
  end_timestamp: number
  tz_offset: number
}) {
  const res = await api.get<{
    success: boolean
    message?: string
    data?: ChannelProfitStats
  }>('/api/data/profit', { params })
  return res.data
}

/** 更新某个渠道的上游倍率 */
export async function updateChannelUpstreamRatio(payload: {
  channel_id: number
  ratio: number
}) {
  const res = await api.put<{ success: boolean; message?: string }>(
    '/api/data/profit/upstream_ratio',
    payload
  )
  return res.data
}

/** 更新统计起点 / 行顺序 / 被移除的行 */
export async function updateProfitSettings(payload: ProfitSettingsPayload) {
  const res = await api.put<{ success: boolean; message?: string }>(
    '/api/data/profit/settings',
    payload
  )
  return res.data
}
