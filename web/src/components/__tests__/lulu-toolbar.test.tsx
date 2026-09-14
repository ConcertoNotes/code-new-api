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
import { expect, test, vi } from 'vitest'

import { LuluToolbar } from '../lulu-toolbar'
import { Button } from '../ui/button'

test('peeking decoration preserves button order, accessible names, disabled state and callbacks', async () => {
  const user = userEvent.setup()
  const edit = vi.fn()
  const more = vi.fn()
  render(
    <LuluToolbar role='group' aria-label='Actions'>
      <Button disabled aria-label='Mute' />
      <Button onClick={edit} aria-label='Edit' />
      <Button onClick={more} aria-label='More' />
    </LuluToolbar>
  )
  const buttons = screen.getAllByRole('button')
  expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
    'Mute',
    'Edit',
    'More',
  ])
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  await user.click(buttons[0])
  expect(buttons[0]).toBeDisabled()
  await user.tab()
  expect(buttons[1]).toHaveFocus()
  await user.keyboard('{Enter}')
  await user.click(buttons[2])
  expect(edit).toHaveBeenCalledTimes(1)
  expect(more).toHaveBeenCalledTimes(1)
})
