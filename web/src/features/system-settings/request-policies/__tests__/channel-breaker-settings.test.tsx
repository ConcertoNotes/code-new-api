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
import { ChannelHealthSection } from '../channel-health-section'
import { defaultRequestPolicySettings } from '../defaults'

const savePolicyConfigMock = vi.hoisted(() => vi.fn())

vi.mock('../api', () => ({
  savePolicyConfig: savePolicyConfigMock,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

function renderSection() {
  const actionsContainer = document.createElement('div')
  document.body.appendChild(actionsContainer)
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <SettingsPageProvider actionsContainer={actionsContainer}>
        <ChannelHealthSection defaultValues={defaultRequestPolicySettings} />
      </SettingsPageProvider>
    </QueryClientProvider>
  )
}

describe('channel breaker settings', () => {
  beforeEach(() => {
    savePolicyConfigMock.mockReset()
    savePolicyConfigMock.mockResolvedValue({ options: {} })
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
      expect(savePolicyConfigMock).toHaveBeenCalledTimes(1)
    })
    expect(savePolicyConfigMock.mock.calls[0][0]).toEqual({
      'channel_breaker_setting.failure_threshold': '5',
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
    expect(savePolicyConfigMock).not.toHaveBeenCalled()
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
    expect(savePolicyConfigMock).not.toHaveBeenCalled()
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
