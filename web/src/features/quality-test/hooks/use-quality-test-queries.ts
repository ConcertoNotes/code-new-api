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
import { useQuery } from '@tanstack/react-query'

import {
  getQualityTestJob,
  getQualityTestJobs,
  getQualityTestOptions,
  getQualityTestPrompts,
} from '../api'
import { isQualityTestActive } from '../lib/quality-test'
import type { QualityTestJobsFilter } from '../types'

export const qualityTestQueryKeys = {
  all: ['quality-test'] as const,
  options: () => [...qualityTestQueryKeys.all, 'options'] as const,
  prompts: () => [...qualityTestQueryKeys.all, 'prompts'] as const,
  jobs: () => [...qualityTestQueryKeys.all, 'jobs'] as const,
  jobList: (page: number, filter: QualityTestJobsFilter) =>
    [...qualityTestQueryKeys.jobs(), 'list', page, filter] as const,
  job: (id: number | undefined) =>
    [...qualityTestQueryKeys.jobs(), 'detail', id] as const,
}

export function useQualityTestOptions() {
  return useQuery({
    queryKey: qualityTestQueryKeys.options(),
    queryFn: getQualityTestOptions,
  })
}

export function useQualityTestPrompts() {
  return useQuery({
    queryKey: qualityTestQueryKeys.prompts(),
    queryFn: getQualityTestPrompts,
  })
}

/** 有运行中的任务时 1.5 秒轮询一次，否则 5 秒；任务生命周期由服务端负责 */
export function useQualityTestJobs(
  page: number,
  filter: QualityTestJobsFilter
) {
  return useQuery({
    queryKey: qualityTestQueryKeys.jobList(page, filter),
    queryFn: () => getQualityTestJobs(page, filter),
    placeholderData: (previous) => previous,
    refetchInterval: (query) =>
      (query.state.data?.active_jobs.length ?? 0) > 0 ? 1500 : 5000,
  })
}

/** 任务运行期间每秒刷新一次输出，结束后停止轮询 */
export function useQualityTestJob(id: number | undefined) {
  return useQuery({
    queryKey: qualityTestQueryKeys.job(id),
    queryFn: () => getQualityTestJob(id as number),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      isQualityTestActive(query.state.data) ? 1000 : false,
  })
}
