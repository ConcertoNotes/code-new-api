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
import assert from 'node:assert/strict'

import { describe, test } from 'vitest'

import type { NavLink } from '../types'

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { SidebarProvider } = await import('@/components/ui/sidebar')
const { useSidebarData } = await import('@/hooks/use-sidebar-data')
const { SidebarMenuLink } = await import('../components/nav-group')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'zh',
  resources: {
    zh: {
      translation: {
        Chat: '聊天',
        Playground: '游乐场',
        'Drawing Workbench': '画图工作台',
      },
    },
  },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

function DrawingWorkbenchLink() {
  const sidebarData = useSidebarData()
  const chatGroup = sidebarData.navGroups.find((group) => group.id === 'chat')
  const playgroundIndex = chatGroup?.items.findIndex(
    (item) => 'url' in item && item.url === '/playground'
  )
  const drawingWorkbench = chatGroup?.items.find(
    (item) => item.title === '画图工作台'
  ) as NavLink | undefined
  const drawingWorkbenchIndex = drawingWorkbench
    ? chatGroup?.items.indexOf(drawingWorkbench)
    : -1

  if (!drawingWorkbench) return null

  return (
    <div
      data-after-playground={
        drawingWorkbenchIndex === (playgroundIndex ?? -2) + 1
      }
      data-shares-playground-toggle={drawingWorkbench.configUrls?.includes(
        '/playground'
      )}
    >
      <SidebarMenuLink item={drawingWorkbench} href='/playground' />
    </div>
  )
}

describe('sidebar navigation', () => {
  test('opens the localized drawing workbench beside playground as a safe external link', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <I18nextProvider i18n={i18n}>
          <SidebarProvider>
            <DrawingWorkbenchLink />
          </SidebarProvider>
        </I18nextProvider>
      )
    })

    const link = container.querySelector<HTMLAnchorElement>(
      'a[href="https://draw.strova.top/"]'
    )
    assert.ok(link)
    assert.equal(link.textContent?.includes('画图工作台'), true)
    assert.equal(link.target, '_blank')
    assert.equal(link.rel, 'noopener noreferrer')
    assert.equal(
      link
        .closest('[data-after-playground]')
        ?.getAttribute('data-after-playground'),
      'true'
    )
    assert.equal(
      link
        .closest('[data-shares-playground-toggle]')
        ?.getAttribute('data-shares-playground-toggle'),
      'true'
    )

    await act(async () => root.unmount())
    container.remove()
  })
})
