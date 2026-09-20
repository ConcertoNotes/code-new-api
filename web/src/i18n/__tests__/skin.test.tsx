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
import i18n from 'i18next'
import { useTranslation } from 'react-i18next'
import { afterEach, beforeAll, describe, expect, test } from 'vitest'

import {
  ThemeCustomizationProvider,
  useThemeCustomization,
} from '@/context/theme-customization-provider'
// 引入真实配置以启用 `react.bindI18nStore`；测试环境已先行初始化了空资源，
// 所以基础中文文案需要在下方手动挂载。
import '@/i18n/config'
import zhCN from '@/i18n/locales/zh.json'
import { applyI18nSkin, readThemeSkinCookie } from '@/i18n/skin'
import { removeCookie, setCookie } from '@/lib/cookies'
import { THEME_COOKIE_KEYS } from '@/lib/theme-customization'

// 验证皮肤切换会替换文案，并且使用 useTranslation 的组件会随之重渲染。
function SidebarLabels() {
  const { t } = useTranslation()
  const { setSkin } = useThemeCustomization()
  return (
    <div>
      <span data-testid='console'>{t('Console')}</span>
      <span data-testid='usage-logs'>{t('Usage Logs')}</span>
      <span data-testid='cancel'>{t('Cancel')}</span>
      <button type='button' onClick={() => setSkin('classic')}>
        classic
      </button>
      <button type='button' onClick={() => setSkin('lulu')}>
        lulu
      </button>
    </div>
  )
}

beforeAll(async () => {
  i18n.addResourceBundle('zhCN', 'translation', zhCN.translation)
  await i18n.changeLanguage('zhCN')
})

afterEach(() => {
  removeCookie(THEME_COOKIE_KEYS.skin)
  applyI18nSkin('lulu')
})

describe('i18n skin wording', () => {
  test('the persisted skin cookie is read at startup and unknown values fall back to Lulu', () => {
    expect(readThemeSkinCookie()).toBe('lulu')
    setCookie(THEME_COOKIE_KEYS.skin, 'classic', 60)
    expect(readThemeSkinCookie()).toBe('classic')
    setCookie(THEME_COOKIE_KEYS.skin, 'neon', 60)
    expect(readThemeSkinCookie()).toBe('lulu')
  })

  test('classic skin restores the upstream wording for renamed keys only', () => {
    applyI18nSkin('classic')
    expect(i18n.t('Console')).toBe('控制台')
    expect(i18n.t('Badge Name')).toBe('名称')
    expect(i18n.t('Console', { lng: 'en' })).toBe('Console')
    expect(i18n.t('Cancel')).toBe('取消')
  })

  test('switching back to the Lulu skin brings the playful wording back', () => {
    applyI18nSkin('classic')
    applyI18nSkin('lulu')
    expect(i18n.t('Console')).toBe('噜噜小屋')
    expect(i18n.t('Badge Name')).toBe('徽章名称')
    expect(i18n.t('Console', { lng: 'en' })).toBe('Lulu Cottage')
  })

  test('components re-render with the new wording when the skin changes', async () => {
    const user = userEvent.setup()
    render(
      <ThemeCustomizationProvider>
        <SidebarLabels />
      </ThemeCustomizationProvider>
    )
    expect(screen.getByTestId('console')).toHaveTextContent('噜噜小屋')
    expect(screen.getByTestId('usage-logs')).toHaveTextContent('足迹册')

    await user.click(screen.getByRole('button', { name: 'classic' }))
    expect(screen.getByTestId('console')).toHaveTextContent('控制台')
    expect(screen.getByTestId('usage-logs')).toHaveTextContent('使用日志')
    expect(screen.getByTestId('cancel')).toHaveTextContent('取消')

    await user.click(screen.getByRole('button', { name: 'lulu' }))
    expect(screen.getByTestId('console')).toHaveTextContent('噜噜小屋')
  })
})
