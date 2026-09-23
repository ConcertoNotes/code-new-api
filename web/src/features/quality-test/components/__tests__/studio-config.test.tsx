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
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { createQualityTestJob, getQualityTestOptions } from '../../api'
import { PELICAN_PROMPT } from '../../constants'
import type { QualityTestJob, QualityTestOptions } from '../../types'
import { StudioConfig } from '../studio-config'

// 仅模拟网络边界
vi.mock('../../api', () => ({
  getQualityTestOptions: vi.fn(),
  createQualityTestJob: vi.fn(),
}))

const options: QualityTestOptions = {
  groups: [
    {
      name: 'default',
      channels: [
        {
          id: 1,
          name: 'openai-main',
          type: 1,
          status: 1,
          models: ['gpt-5', 'gpt-5-mini'],
          default_endpoint: 'openai',
        },
      ],
    },
    {
      name: 'vip',
      channels: [
        {
          id: 7,
          name: 'claude-vip',
          type: 14,
          status: 1,
          models: ['claude-opus'],
          default_endpoint: 'anthropic',
        },
        {
          id: 8,
          name: 'codex-vip',
          type: 57,
          status: 2,
          models: ['gpt-5-codex'],
          default_endpoint: 'openai-response',
        },
      ],
    },
  ],
  reasoning_efforts: {
    openai: ['', 'low', 'medium', 'high'],
    'openai-response': ['', 'low', 'medium', 'high'],
    anthropic: ['', 'low', 'medium', 'high', 'max'],
  },
  concurrency_limit: 3,
}

function renderConfig(activeJobs: QualityTestJob[] = []) {
  vi.mocked(getQualityTestOptions).mockResolvedValue(options)
  const onStarted = vi.fn()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <StudioConfig
        prompt={PELICAN_PROMPT}
        onPromptChange={vi.fn()}
        presets={[]}
        presetsLoading={false}
        activeJobs={activeJobs}
        concurrencyLimit={3}
        onEditPreset={vi.fn()}
        onStarted={onStarted}
      />
    </QueryClientProvider>
  )
  return { onStarted }
}

// 等待选项加载完成后再选择分组
async function selectGroup(
  user: ReturnType<typeof userEvent.setup>,
  group: string
) {
  await screen.findByRole('option', { name: group })
  await user.selectOptions(screen.getByLabelText('Group'), group)
}

async function chooseGroupAndChannel(group: string, channelId: string) {
  const user = userEvent.setup()
  await selectGroup(user, group)
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Test channel' }),
    channelId
  )
  return user
}

describe('StudioConfig', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('selecting a group lists only the channels that belong to that group', async () => {
    const user = userEvent.setup()
    renderConfig()

    await selectGroup(user, 'vip')

    const channelSelect = screen.getByRole('combobox', { name: 'Test channel' })
    const labels = within(channelSelect)
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(labels).toEqual([
      'Select a channel',
      '#7 claude-vip · Anthropic',
      '#8 codex-vip · ChatGPT Subscription (Codex) (Disabled)',
    ])
  })

  test('choosing a channel defaults to its first model and native endpoint', async () => {
    renderConfig()

    await chooseGroupAndChannel('vip', '7')

    expect(screen.getByLabelText('Test model')).toHaveValue('claude-opus')
    expect(screen.getByLabelText('Request endpoint')).toHaveValue('anthropic')
    expect(screen.getByLabelText('Reasoning effort')).toHaveValue('high')
  })

  test('starting a test submits the selected group, channel and preset provenance', async () => {
    vi.mocked(createQualityTestJob).mockResolvedValue({
      id: 42,
    } as QualityTestJob)
    const { onStarted } = renderConfig()

    const user = await chooseGroupAndChannel('default', '1')
    await user.click(screen.getByRole('button', { name: 'Start test' }))

    await waitFor(() => expect(onStarted).toHaveBeenCalledWith({ id: 42 }))
    expect(vi.mocked(createQualityTestJob).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        group: 'default',
        channel_id: 1,
        model: 'gpt-5',
        endpoint_type: 'openai',
        reasoning_effort: 'high',
        prompt: PELICAN_PROMPT,
        preset_key: 'pelican',
      })
    )
  })

  test('a channel that already has a running test cannot start another one', async () => {
    renderConfig([
      { id: 5, channel_id: 7, status: 'running' } as QualityTestJob,
    ])

    await chooseGroupAndChannel('vip', '7')

    expect(
      screen.getByRole('button', {
        name: 'This channel is already being tested',
      })
    ).toBeDisabled()
  })
})
