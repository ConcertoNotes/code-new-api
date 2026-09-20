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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test } from 'vitest'

import { ConfigDrawer } from '@/components/config-drawer'
import { SidebarProvider } from '@/components/ui/sidebar'
import { DirectionProvider } from '@/context/direction-provider'
import { LayoutProvider } from '@/context/layout-provider'
import { ThemeCustomizationProvider } from '@/context/theme-customization-provider'
import { ThemeProvider } from '@/context/theme-provider'
import { removeCookie } from '@/lib/cookies'
import { THEME_COOKIE_KEYS } from '@/lib/theme-customization'

function renderDrawer() {
  return render(
    <ThemeProvider>
      <DirectionProvider>
        <LayoutProvider>
          <SidebarProvider>
            <ThemeCustomizationProvider>
              <ConfigDrawer />
            </ThemeCustomizationProvider>
          </SidebarProvider>
        </LayoutProvider>
      </DirectionProvider>
    </ThemeProvider>
  )
}

async function openDrawer() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Open theme settings' }))
  const group = await screen.findByRole('radiogroup', {
    name: 'Select UI style',
  })
  return { user, group }
}

afterEach(() => {
  removeCookie(THEME_COOKIE_KEYS.skin)
  document.body.removeAttribute('data-theme-skin')
})

describe('ConfigDrawer UI style selector', () => {
  test('offers exactly the Lulu and Original skins with Lulu selected by default', async () => {
    renderDrawer()
    const { group } = await openDrawer()
    const radios = within(group).getAllByRole('radio')
    expect(radios.map((radio) => radio.getAttribute('aria-label'))).toEqual([
      'skin.lulu',
      'skin.classic',
    ])
    expect(radios[0]).toHaveAttribute('aria-checked', 'true')
    expect(radios[1]).toHaveAttribute('aria-checked', 'false')
  })

  test('picking Original switches <body> to the classic skin', async () => {
    renderDrawer()
    const { user, group } = await openDrawer()
    await user.click(within(group).getByRole('radio', { name: 'skin.classic' }))
    expect(
      within(group).getByRole('radio', { name: 'skin.classic' })
    ).toHaveAttribute('aria-checked', 'true')
    expect(document.body).toHaveAttribute('data-theme-skin', 'classic')
  })
})
