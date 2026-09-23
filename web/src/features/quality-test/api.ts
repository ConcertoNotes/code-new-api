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

import type {
  ApiResponse,
  CreateQualityTestPayload,
  QualityTestJob,
  QualityTestJobsFilter,
  QualityTestJobsPage,
  QualityTestOptions,
  QualityTestPrompt,
} from './types'

export const QUALITY_TEST_PAGE_SIZE = 20

/** 解包 { success, message, data }，失败时抛出服务端消息 */
function unwrap<T>(res: ApiResponse<T>, fallback: string): T {
  if (!res.success || res.data === undefined) {
    throw new Error(res.message || fallback)
  }
  return res.data
}

export async function getQualityTestOptions() {
  const res = await api.get<ApiResponse<QualityTestOptions>>(
    '/api/quality_test/options'
  )
  return unwrap(res.data, 'Failed to load test options')
}

export async function getQualityTestJobs(
  page: number,
  filter: QualityTestJobsFilter
) {
  const res = await api.get<ApiResponse<QualityTestJobsPage>>(
    '/api/quality_test/jobs',
    {
      params: {
        p: page,
        page_size: QUALITY_TEST_PAGE_SIZE,
        ...filter,
      },
      // 轮询请求不走 GET 去重，保证每次都拿到最新状态
      disableDuplicate: true,
    }
  )
  return unwrap(res.data, 'Failed to load test records')
}

export async function getQualityTestJob(id: number) {
  const res = await api.get<ApiResponse<QualityTestJob>>(
    `/api/quality_test/jobs/${id}`,
    { disableDuplicate: true }
  )
  return unwrap(res.data, 'Failed to load test record')
}

export async function createQualityTestJob(payload: CreateQualityTestPayload) {
  const res = await api.post<ApiResponse<QualityTestJob>>(
    '/api/quality_test/jobs',
    payload
  )
  return unwrap(res.data, 'Failed to start the test')
}

export async function cancelQualityTestJob(id: number) {
  const res = await api.post<ApiResponse<QualityTestJob>>(
    `/api/quality_test/jobs/${id}/cancel`
  )
  return unwrap(res.data, 'Failed to stop the test')
}

export async function getQualityTestPrompts() {
  const res = await api.get<ApiResponse<QualityTestPrompt[]>>(
    '/api/quality_test/prompts'
  )
  return unwrap(res.data, 'Failed to load prompt presets')
}

export async function saveQualityTestPrompt(payload: {
  id?: number
  name: string
  prompt: string
}) {
  const body = { name: payload.name, prompt: payload.prompt }
  const res = payload.id
    ? await api.put<ApiResponse<QualityTestPrompt>>(
        `/api/quality_test/prompts/${payload.id}`,
        body
      )
    : await api.post<ApiResponse<QualityTestPrompt>>(
        '/api/quality_test/prompts',
        body
      )
  return unwrap(res.data, 'Failed to save the prompt preset')
}

export async function deleteQualityTestPrompt(id: number) {
  const res = await api.delete<ApiResponse<null>>(
    `/api/quality_test/prompts/${id}`
  )
  if (!res.data.success) {
    throw new Error(res.data.message || 'Failed to delete the prompt preset')
  }
}
