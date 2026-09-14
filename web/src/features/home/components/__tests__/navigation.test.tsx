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
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { ModernLanding } from '../modern-landing'

function renderLanding(isAuthenticated: boolean) {
  const root = createRootRoute({
    component: () => <ModernLanding isAuthenticated={isAuthenticated} />,
  })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory(),
  })
  return render(<RouterProvider router={router} />)
}

describe('Landing navigation', () => {
  test('visitors can start registration from the hero and final call to action', async () => {
    renderLanding(false)
    const main = await screen.findByRole('main')
    const links = within(main).getAllByRole('link', { name: 'Start now' })
    expect(links).toHaveLength(2)
    for (const link of links) expect(link).toHaveAttribute('href', '/sign-up')
  })

  test('signed-in visitors go directly to the dashboard', async () => {
    renderLanding(true)
    const main = await screen.findByRole('main')
    const links = within(main).getAllByRole('link', { name: 'Go to Dashboard' })
    expect(links).toHaveLength(2)
    for (const link of links) expect(link).toHaveAttribute('href', '/dashboard')
    expect(
      within(main).queryByRole('link', { name: 'Start now' })
    ).not.toBeInTheDocument()
  })

  test('the capabilities anchor and model catalog link have real destinations', async () => {
    renderLanding(false)
    const main = await screen.findByRole('main')
    const explore = within(main).getByRole('link', {
      name: 'Explore capabilities',
    })
    const target = explore.getAttribute('href')
    expect(target).toBe('#lulu-features')
    expect(document.querySelector(target ?? '')).toHaveAccessibleName(
      'Powerful underneath. Effortless on the surface.'
    )
    expect(
      within(main).getByRole('link', { name: 'More models' })
    ).toHaveAttribute('href', '/pricing')
    expect(
      within(main).getByRole('link', { name: 'Variable Switch' })
    ).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
