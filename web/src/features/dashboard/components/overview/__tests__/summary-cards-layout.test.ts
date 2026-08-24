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
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { test } from 'vitest'

const OVERVIEW_DIRECTORY = path.resolve(
  'src/features/dashboard/components/overview'
)
const UI_DIRECTORY = path.resolve('src/features/dashboard/components/ui')

test('usage summary keeps four metrics readable across mobile and desktop', async () => {
  const source = await readFile(
    path.join(OVERVIEW_DIRECTORY, 'summary-cards.tsx'),
    'utf8'
  )

  assert.match(source, /grid grid-cols-2[^']*xl:grid-cols-4/)
  assert.match(source, /details=\{it\.details\}/)
})

test('official and all-time details remain visible on mobile', async () => {
  const source = await readFile(
    path.join(UI_DIRECTORY, 'stat-card.tsx'),
    'utf8'
  )

  assert.match(source, /!props\.details\?\.length && 'hidden sm:block'/)
})
