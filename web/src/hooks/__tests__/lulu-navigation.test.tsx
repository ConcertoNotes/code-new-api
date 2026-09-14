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
import { renderHook, act } from '@testing-library/react'
import { createInstance } from 'i18next'
import type { ReactNode } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { expect, test } from 'vitest'

import en from '@/i18n/locales/en.json'
import zh from '@/i18n/locales/zh.json'

import { useSidebarData } from '../use-sidebar-data'

test('Chinese island navigation preserves destinations and updates when the language changes', async () => {
  const i18n = createInstance()
  await i18n.use(initReactI18next).init({
    lng: 'zh',
    resources: { en, zh },
  })
  function Wrapper(props: { children: ReactNode }) {
    return <I18nextProvider i18n={i18n}>{props.children}</I18nextProvider>
  }
  const { result } = renderHook(() => useSidebarData(), { wrapper: Wrapper })
  expect(result.current.navGroups.map((group) => group.title)).toEqual([
    '玩耍',
    '日常',
    '我的',
    '庄园管理',
  ])
  const daily = result.current.navGroups.find((group) => group.id === 'general')
  expect(
    daily?.items.map((item) => [item.title, 'url' in item && item.url])
  ).toEqual([
    ['今日噜噜', '/dashboard/overview'],
    ['水豚看板', '/dashboard/models'],
    ['通行徽章', '/keys'],
    ['足迹册', '/usage-logs/common'],
    ['冒险记录', '/usage-logs/task'],
  ])
  expect(i18n.t('Admin')).toBe('管理员')
  expect(i18n.t('Model')).toBe('模型')
  await act(async () => {
    await i18n.changeLanguage('en')
  })
  const english = result.current.navGroups.find(
    (group) => group.id === 'general'
  )
  expect(
    english?.items.find((item) => 'url' in item && item.url === '/keys')?.title
  ).toBe('Access Badges')
})
