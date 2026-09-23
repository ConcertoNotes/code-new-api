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
import { CHANNEL_TYPES } from '@/features/channels/constants'

import type { QualityTestChannelOption, QualityTestGroupOption } from '../types'

export function qualityTestChannelTypeName(type: number): string {
  return (CHANNEL_TYPES as Record<number, string>)[type] ?? `Type ${type}`
}

/** 按名称、ID 或渠道类型搜索分组内的渠道 */
export function filterQualityTestChannels(
  group: QualityTestGroupOption | undefined,
  search: string
): QualityTestChannelOption[] {
  if (!group) return []
  const keyword = search.trim().toLowerCase()
  if (!keyword) return group.channels
  return group.channels.filter(
    (channel) =>
      channel.name.toLowerCase().includes(keyword) ||
      String(channel.id) === keyword.replace(/^#/, '') ||
      qualityTestChannelTypeName(channel.type).toLowerCase().includes(keyword)
  )
}

/** 当前选择不在可选列表中时回退到默认值：优先 high，其次模型默认 */
export function resolveQualityTestEffort(
  efforts: string[],
  current: string
): string {
  if (efforts.includes(current)) return current
  if (efforts.includes('high')) return 'high'
  return efforts[0] ?? ''
}

export function resolveQualityTestModel(
  channel: QualityTestChannelOption | undefined,
  current: string
): string {
  if (!channel) return ''
  return channel.models.includes(current) ? current : (channel.models[0] ?? '')
}
