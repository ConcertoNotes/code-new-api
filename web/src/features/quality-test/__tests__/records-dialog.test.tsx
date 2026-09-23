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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { QualityTest } from '..'
import {
  getQualityTestJob,
  getQualityTestJobs,
  getQualityTestPrompts,
} from '../api'
import type { QualityTestJob, QualityTestJobsPage } from '../types'

// 模拟网络边界与路由搜索参数
vi.mock('../api', () => ({
  QUALITY_TEST_PAGE_SIZE: 20,
  getQualityTestJobs: vi.fn(),
  getQualityTestJob: vi.fn(),
  getQualityTestPrompts: vi.fn(),
  getQualityTestOptions: vi.fn(),
  createQualityTestJob: vi.fn(),
  cancelQualityTestJob: vi.fn(),
  saveQualityTestPrompt: vi.fn(),
  deleteQualityTestPrompt: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  getRouteApi: () => ({
    useSearch: () => ({ view: 'history' }),
    useNavigate: () => vi.fn(),
  }),
}))

const job: QualityTestJob = {
  id: 1,
  channel_id: 26,
  channel_name: 'Elucid',
  channel_type: 57,
  group: 'codex-pro',
  model: 'gpt-6-astra',
  reasoning_effort: 'high',
  endpoint_type: 'openai-response',
  status: 'completed',
  preset_kind: 'builtin',
  preset_ref: 'pelican',
  preset_name: '',
  duration_ms: 247500,
  output_tokens: 13013,
  created_at: 1790132853,
  updated_at: 1790133100,
}

const page: QualityTestJobsPage = {
  jobs: [job],
  active_jobs: [],
  total: 1,
  concurrency_limit: 3,
  facets: {
    groups: ['codex-pro'],
    models: ['gpt-6-astra'],
    efforts: ['high'],
    channels: [],
    presets: [],
  },
}

describe('QualityTest records', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('clicking view result on a completed record opens the result dialog with its details', async () => {
    vi.mocked(getQualityTestJobs).mockResolvedValue(page)
    vi.mocked(getQualityTestPrompts).mockResolvedValue([])
    vi.mocked(getQualityTestJob).mockResolvedValue({
      ...job,
      output: '<svg></svg>',
      prompt: 'draw',
    })
    const user = userEvent.setup()
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <QualityTest />
      </QueryClientProvider>
    )

    await user.click(await screen.findByRole('button', { name: 'View result' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Generated result')
    expect(
      await screen.findByText('Elucid · #26 / gpt-6-astra')
    ).toBeInTheDocument()
    expect(getQualityTestJob).toHaveBeenCalledWith(1)
  })
})
