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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { RoutingReliabilitySection } from '../routing-reliability-section'

const updateSystemOptionMock = vi.hoisted(() => vi.fn())

vi.mock('../../api', () => ({
  updateSystemOption: updateSystemOptionMock,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const defaultValues = {
  RetryTimes: 3,
  ChannelDisableThreshold: '',
  AutomaticDisableChannelEnabled: false,
  AutomaticEnableChannelEnabled: false,
  AutomaticDisableKeywords: '',
  AutomaticDisableStatusCodes: '401',
  AutomaticRetryStatusCodes: '500-599',
  'monitor_setting.auto_test_channel_enabled': false,
  'monitor_setting.auto_test_channel_minutes': 10,
  'monitor_setting.channel_test_concurrency': 1,
  'monitor_setting.channel_test_mode': 'scheduled_all' as const,
  'channel_breaker_setting.enabled': true,
  'channel_breaker_setting.failure_threshold': 3,
  'channel_breaker_setting.failure_window_seconds': 60,
  'channel_breaker_setting.cooldown_seconds': 30,
  'channel_breaker_setting.max_cooldown_seconds': 600,
  'channel_breaker_setting.status_codes': '408,429,500-599',
}

function renderSection() {
  const actionsContainer = document.createElement('div')
  document.body.appendChild(actionsContainer)
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <SettingsPageProvider actionsContainer={actionsContainer}>
        <RoutingReliabilitySection defaultValues={defaultValues} />
      </SettingsPageProvider>
    </QueryClientProvider>
  )
  return actionsContainer
}

describe('channel breaker settings', () => {
  beforeEach(() => {
    updateSystemOptionMock.mockReset()
    updateSystemOptionMock.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('saving a changed failure threshold sends only the breaker option that changed', async () => {
    renderSection()

    const thresholdInput = screen.getByRole('spinbutton', {
      name: 'Consecutive failures to trip',
    })
    fireEvent.change(thresholdInput, { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => {
      expect(updateSystemOptionMock).toHaveBeenCalledTimes(1)
    })
    expect(updateSystemOptionMock).toHaveBeenCalledWith({
      key: 'channel_breaker_setting.failure_threshold',
      value: 5,
    })
  })

  test('invalid cooldown status codes block saving and show the validation message', async () => {
    renderSection()

    const statusCodesInput = screen.getByPlaceholderText(
      'e.g. 408, 429, 500-599'
    )
    fireEvent.change(statusCodesInput, { target: { value: '5xx' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(
      await screen.findByText('Invalid status code rules: 5xx')
    ).toBeInTheDocument()
    expect(updateSystemOptionMock).not.toHaveBeenCalled()
  })

  test('max cooldown below the initial cooldown is rejected', async () => {
    renderSection()

    const maxCooldownInput = screen.getByRole('spinbutton', {
      name: 'Max cooldown (seconds)',
    })
    fireEvent.change(maxCooldownInput, { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(
      await screen.findByText(
        'Max cooldown must be at least the initial cooldown'
      )
    ).toBeInTheDocument()
    expect(updateSystemOptionMock).not.toHaveBeenCalled()
  })

  test('turning the cooldown switch off disables the breaker inputs', () => {
    renderSection()

    const toggle = screen.getByRole('switch', {
      name: 'Enable channel cooldown',
    })
    const thresholdInput = screen.getByRole('spinbutton', {
      name: 'Consecutive failures to trip',
    })
    expect(thresholdInput).toBeEnabled()

    fireEvent.click(toggle)

    expect(thresholdInput).toBeDisabled()
    expect(screen.getByPlaceholderText('e.g. 408, 429, 500-599')).toBeDisabled()
  })
})
