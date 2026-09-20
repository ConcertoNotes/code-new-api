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
import { afterEach, describe, expect, test } from 'vitest'

import {
  ThemeCustomizationProvider,
  useThemeCustomization,
} from '@/context/theme-customization-provider'
import { getCookie, removeCookie, setCookie } from '@/lib/cookies'
import { THEME_COOKIE_KEYS } from '@/lib/theme-customization'

// 用一个最小消费者暴露皮肤状态与切换动作，避免依赖设置抽屉的全部 provider。
function SkinProbe() {
  const { customization, setSkin, setPreset, resetCustomization } =
    useThemeCustomization()
  return (
    <div>
      <output data-testid='skin'>{customization.skin}</output>
      <output data-testid='preset'>{customization.preset}</output>
      <button type='button' onClick={() => setSkin('classic')}>
        use classic
      </button>
      <button type='button' onClick={() => setSkin('lulu')}>
        use lulu
      </button>
      <button type='button' onClick={() => setPreset('aurora')}>
        use aurora
      </button>
      <button type='button' onClick={resetCustomization}>
        reset
      </button>
    </div>
  )
}

function renderProbe() {
  return render(
    <ThemeCustomizationProvider>
      <SkinProbe />
    </ThemeCustomizationProvider>
  )
}

afterEach(() => {
  removeCookie(THEME_COOKIE_KEYS.skin)
  removeCookie(THEME_COOKIE_KEYS.preset)
  document.body.removeAttribute('data-theme-skin')
  document.body.removeAttribute('data-theme-preset')
})

describe('theme skin axis', () => {
  test('defaults to the Lulu skin and mirrors it onto <body>', () => {
    renderProbe()
    expect(screen.getByTestId('skin')).toHaveTextContent('lulu')
    expect(document.body).toHaveAttribute('data-theme-skin', 'lulu')
  })

  test('choosing the Original skin updates <body> and persists a cookie while the color preset stays untouched', async () => {
    const user = userEvent.setup()
    renderProbe()
    await user.click(screen.getByRole('button', { name: 'use classic' }))
    expect(document.body).toHaveAttribute('data-theme-skin', 'classic')
    expect(getCookie(THEME_COOKIE_KEYS.skin)).toBe('classic')
    expect(screen.getByTestId('preset')).toHaveTextContent('lulu')
    expect(document.body).toHaveAttribute('data-theme-preset', 'lulu')
  })

  test('switching color preset does not change the skin', async () => {
    const user = userEvent.setup()
    renderProbe()
    await user.click(screen.getByRole('button', { name: 'use classic' }))
    await user.click(screen.getByRole('button', { name: 'use aurora' }))
    expect(document.body).toHaveAttribute('data-theme-preset', 'aurora')
    expect(document.body).toHaveAttribute('data-theme-skin', 'classic')
  })

  test('a persisted Original skin cookie is restored on mount', () => {
    setCookie(THEME_COOKIE_KEYS.skin, 'classic', 60)
    renderProbe()
    expect(screen.getByTestId('skin')).toHaveTextContent('classic')
    expect(document.body).toHaveAttribute('data-theme-skin', 'classic')
  })

  test('an unknown skin cookie falls back to the Lulu default', () => {
    setCookie(THEME_COOKIE_KEYS.skin, 'neon', 60)
    renderProbe()
    expect(document.body).toHaveAttribute('data-theme-skin', 'lulu')
  })

  test('reset returns to the Lulu skin and clears the cookie', async () => {
    const user = userEvent.setup()
    renderProbe()
    await user.click(screen.getByRole('button', { name: 'use classic' }))
    await user.click(screen.getByRole('button', { name: 'reset' }))
    expect(document.body).toHaveAttribute('data-theme-skin', 'lulu')
    expect(getCookie(THEME_COOKIE_KEYS.skin)).toBeUndefined()
  })
})
