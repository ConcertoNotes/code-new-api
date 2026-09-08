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
import { describe, expect, test } from 'vitest'

import { ModernLanding } from '../modern-landing'

const i18n = (await import('i18next')).default
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} = await import('@tanstack/react-router')

await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

function renderLanding() {
  const rootRoute = createRootRoute({
    component: () => (
      <I18nextProvider i18n={i18n}>
        <ModernLanding isAuthenticated={false} />
      </I18nextProvider>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory(),
  })
  return render(<RouterProvider router={router} />)
}

describe('ModernLanding theme', () => {
  test('landing root follows theme tokens so the page matches the console background', async () => {
    renderLanding()
    const main = await screen.findByRole('main')
    expect(main.className).toContain('bg-background')
    expect(main.className).toContain('text-foreground')
    expect(main.className).not.toMatch(/bg-\[#/)
  })
})
