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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { CodePreview } from '../code-preview'

const originalExecCommand = Object.getOwnPropertyDescriptor(
  document,
  'execCommand'
)
afterEach(() => {
  vi.unstubAllGlobals()
  if (originalExecCommand) {
    Object.defineProperty(document, 'execCommand', originalExecCommand)
  } else {
    Reflect.deleteProperty(document, 'execCommand')
  }
})

describe('Home code examples', () => {
  test('switching language displays and copies the selected example', async () => {
    const user = userEvent.setup()
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue()
    render(<CodePreview />)
    await user.click(screen.getByRole('tab', { name: 'Curl' }))
    const panel = screen.getByRole('tabpanel', { name: 'Curl' })
    expect(panel.textContent).toContain('curl ')
    await user.click(screen.getByRole('button', { name: 'Copy code' }))
    expect(writeText).toHaveBeenCalledWith(
      panel.querySelector('code')?.textContent
    )
    expect(screen.getByRole('status')).toHaveTextContent('Copied')
    await user.click(screen.getByRole('tab', { name: 'JavaScript' }))
    expect(
      screen.getByRole('tabpanel', { name: 'JavaScript' })
    ).toHaveTextContent('import OpenAI')
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeEnabled()
  })

  test('arrow keys navigate code language tabs', async () => {
    const user = userEvent.setup()
    render(<CodePreview />)
    screen.getByRole('tab', { name: 'Python' }).focus()
    await user.keyboard('{ArrowRight}{Enter}')
    expect(screen.getByRole('tab', { name: 'Curl' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  test('denied clipboard access shows failure instead of success', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new Error('Denied')
    )
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: () => false,
    })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    render(<CodePreview />)
    await user.click(screen.getByRole('button', { name: 'Copy code' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Copy failed. Please select and copy the code.'
    )
    expect(screen.getByText('Example response')).toBeVisible()
  })
})
