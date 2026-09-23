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
export type QualityTestStatus =
  | 'running'
  | 'cancelling'
  | 'completed'
  | 'error'
  | 'stopped'
  | 'interrupted'

export type QualityTestPresetKind = '' | 'builtin' | 'custom'

export type QualityTestJob = {
  id: number
  channel_id: number
  channel_name: string
  channel_type: number
  group: string
  model: string
  reasoning_effort: string
  endpoint_type: string
  prompt?: string
  output?: string
  status: QualityTestStatus
  preset_kind: QualityTestPresetKind
  preset_ref: string
  preset_name: string
  error?: string
  response_model?: string
  duration_ms: number
  first_content_ms?: number
  input_tokens?: number
  output_tokens?: number
  reasoning_tokens?: number
  /** Unix 秒 */
  created_at: number
  updated_at: number
  completed_at?: number
}

export type QualityTestPrompt = {
  id: number
  name: string
  prompt: string
  usage_count: number
  last_used_at?: number
  created_at: number
  updated_at: number
}

export type QualityTestFacets = {
  groups: string[]
  models: string[]
  efforts: string[]
  channels: { id: number; name: string }[]
  presets: { kind: 'builtin' | 'custom'; ref: string; name: string }[]
}

export type QualityTestJobsPage = {
  jobs: QualityTestJob[]
  active_jobs: QualityTestJob[]
  total: number
  concurrency_limit: number
  facets: QualityTestFacets
}

/**
 * 记录筛选；effort 为 'default' 表示使用模型默认强度的记录，
 * preset 取值为 'none' | 'builtin:<key>' | 'custom:<id>'
 */
export type QualityTestJobsFilter = {
  group?: string
  channel_id?: number
  model?: string
  effort?: string
  preset?: string
}

export type QualityTestChannelOption = {
  id: number
  name: string
  type: number
  status: number
  models: string[]
  default_endpoint: string
}

export type QualityTestGroupOption = {
  name: string
  channels: QualityTestChannelOption[]
}

export type QualityTestOptions = {
  groups: QualityTestGroupOption[]
  reasoning_efforts: Record<string, string[]>
  concurrency_limit: number
}

export type CreateQualityTestPayload = {
  group: string
  channel_id: number
  model: string
  reasoning_effort: string
  endpoint_type: string
  prompt: string
  prompt_id?: number
  preset_key?: string
  preset_name?: string
}

export type QualityTestView = 'studio' | 'presets' | 'history'

export type ApiResponse<T> = {
  success: boolean
  message?: string
  data?: T
}
