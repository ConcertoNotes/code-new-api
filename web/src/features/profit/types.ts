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
/** 单个渠道在单个分组下的收支明细 */
export type ChannelProfitRow = {
  /** 行键：`渠道ID|分组`，用于排序与移除 */
  key: string
  channel_id: number
  channel_name: string
  channel_type: number
  channel_status: number
  channel_exists: boolean
  /** 已被管理员从收支页移除 */
  hidden: boolean
  group: string
  sell_ratio: number
  upstream_ratio: number
  requests: number
  quota: number
  official_quota: number
  cost_quota: number
  profit_quota: number
  last_used_at: number
}

/** 按天汇总的收支趋势点 */
export type ChannelProfitTrendPoint = {
  date: number
  quota: number
  cost_quota: number
  profit_quota: number
}

/** 时间范围内的收支汇总 */
export type ChannelProfitSummary = {
  quota: number
  official_quota: number
  cost_quota: number
  profit_quota: number
  requests: number
  active_channels: number
  total_channels: number
}

export type ChannelProfitStats = {
  start_timestamp: number
  end_timestamp: number
  /** 统计起点（Unix 秒），之前的日志不计入 */
  stats_start_at: number
  row_order: string[]
  hidden_rows: string[]
  group_ratio: Record<string, number>
  channel_upstream_ratio: Record<string, number>
  summary: ChannelProfitSummary
  rows: ChannelProfitRow[]
  trend: ChannelProfitTrendPoint[]
}

export type ProfitStatusFilter = 'all' | 'enabled' | 'disabled'

/** 只更新传入的字段；stats_start_at 传 0 表示从现在重新开始统计 */
export type ProfitSettingsPayload = {
  stats_start_at?: number
  row_order?: string[]
  hidden_rows?: string[]
}
