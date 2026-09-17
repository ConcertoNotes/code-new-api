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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { UpstreamRatioCell } from '../upstream-ratio-cell'

function renderCell(overrides?: { ratio?: number; saving?: boolean }) {
  const onSave = vi.fn().mockResolvedValue(undefined)
  render(
    <UpstreamRatioCell
      channelId={7}
      channelName='OpenAI'
      ratio={overrides?.ratio ?? 1}
      saving={overrides?.saving}
      onSave={onSave}
    />
  )
  return { onSave }
}

describe('UpstreamRatioCell', () => {
  test('shows the formatted ratio and an edit button when idle', () => {
    renderCell({ ratio: 0.5 })
    expect(screen.getByText('0.5')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Edit upstream ratio of OpenAI' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  test('pressing Enter with a valid number saves and leaves edit mode', async () => {
    const user = userEvent.setup()
    const { onSave } = renderCell({ ratio: 1 })
    await user.click(
      screen.getByRole('button', { name: 'Edit upstream ratio of OpenAI' })
    )
    const input = screen.getByRole('spinbutton', {
      name: 'Upstream ratio of OpenAI',
    })
    await user.clear(input)
    await user.type(input, '0.75{Enter}')
    expect(onSave).toHaveBeenCalledWith(0.75)
    await waitFor(() =>
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    )
  })

  test('negative or empty input is marked invalid and not saved', async () => {
    const user = userEvent.setup()
    const { onSave } = renderCell()
    await user.click(
      screen.getByRole('button', { name: 'Edit upstream ratio of OpenAI' })
    )
    const input = screen.getByRole('spinbutton', {
      name: 'Upstream ratio of OpenAI',
    })
    await user.clear(input)
    await user.type(input, '-2')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  test('pressing Escape cancels without saving', async () => {
    const user = userEvent.setup()
    const { onSave } = renderCell({ ratio: 2 })
    await user.click(
      screen.getByRole('button', { name: 'Edit upstream ratio of OpenAI' })
    )
    await user.keyboard('{Escape}')
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  test('controls are disabled while saving', async () => {
    const user = userEvent.setup()
    renderCell({ saving: true })
    await user.click(
      screen.getByRole('button', { name: 'Edit upstream ratio of OpenAI' })
    )
    expect(screen.getByRole('spinbutton')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })
})
