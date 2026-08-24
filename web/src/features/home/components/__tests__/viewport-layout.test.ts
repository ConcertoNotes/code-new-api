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

const COMPONENT_DIRECTORY = path.resolve('src/features/home/components')
const HOME_STYLES = path.resolve('src/styles/index.css')

test('desktop landing keeps the hero and raised marquee within one viewport', async () => {
  const [landingSource, marqueeSource] = await Promise.all([
    readFile(path.join(COMPONENT_DIRECTORY, 'modern-landing.tsx'), 'utf8'),
    readFile(path.join(COMPONENT_DIRECTORY, 'model-marquee.tsx'), 'utf8'),
  ])

  assert.match(landingSource, /min-h-svh[^']*lg:h-svh/)
  assert.match(landingSource, /flex min-h-0 flex-1/)
  assert.match(marqueeSource, /lg:-mt-4/)
})

test('hero keeps variable switch beside the primary action', async () => {
  const landingSource = await readFile(
    path.join(COMPONENT_DIRECTORY, 'modern-landing.tsx'),
    'utf8'
  )

  assert.match(landingSource, /href=\{VARIABLE_SWITCH_URL\}/)
  assert.match(landingSource, /t\('Variable Switch'\)/)
})

test('home fluid background starts with the bright purple aurora frame', async () => {
  const styles = await readFile(HOME_STYLES, 'utf8')
  const fluidBackground = styles.match(
    /\.home-fluid-background \{(?<rules>[\s\S]*?)\n\}/
  )?.groups?.rules
  const auroraOverlay = styles.match(
    /\.home-fluid-background::after \{(?<rules>[\s\S]*?)\n\}/
  )?.groups?.rules

  assert.match(fluidBackground ?? '', /#7542b6 5%/)
  assert.match(auroraOverlay ?? '', /infinite alternate;/)
  assert.doesNotMatch(auroraOverlay ?? '', /alternate-reverse/)
})
