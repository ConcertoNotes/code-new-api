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
import test from 'node:test'

import {
  DEFAULT_THEME_CUSTOMIZATION,
  THEME_PRESETS,
} from '../theme-customization.ts'

test('aurora is the default color preset and white preserves the old default palette', () => {
  assert.equal(DEFAULT_THEME_CUSTOMIZATION.preset, 'aurora')
  assert.equal(THEME_PRESETS[0].value, 'aurora')
  assert.equal(
    THEME_PRESETS.find((preset) => preset.value === 'default')?.name,
    'White'
  )
})

test('aurora canvas is shared by public and authenticated page layouts', async () => {
  const [publicLayout, authenticatedLayout, themeStyles] = await Promise.all([
    readFile(
      new URL(
        '../../components/layout/components/public-layout.tsx',
        import.meta.url
      ),
      'utf8'
    ),
    readFile(
      new URL(
        '../../components/layout/components/authenticated-layout.tsx',
        import.meta.url
      ),
      'utf8'
    ),
    readFile(
      new URL('../../styles/theme-presets.css', import.meta.url),
      'utf8'
    ),
  ])

  assert.match(publicLayout, /app-theme-canvas/)
  assert.match(authenticatedLayout, /app-theme-canvas/)
  assert.match(themeStyles, /\[data-theme-preset='aurora'\]/)
  assert.match(themeStyles, /--app-canvas-background:/)
})
