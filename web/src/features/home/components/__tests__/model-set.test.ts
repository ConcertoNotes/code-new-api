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

import { test } from 'vitest'

import {
  HOME_MARQUEE_MODELS,
  HOME_MARQUEE_SEQUENCES,
} from '../model-marquee-data.ts'

test('home marquee exposes exactly the four approved model names', () => {
  assert.deepEqual(
    [...HOME_MARQUEE_MODELS],
    ['OpenAI', 'Claude Code', 'GLM', 'DeepSeek']
  )
})

test('home marquee repeats the same model sequence for a seamless loop', () => {
  assert.equal(HOME_MARQUEE_SEQUENCES.length, 2)
  assert.deepEqual(HOME_MARQUEE_SEQUENCES[0], HOME_MARQUEE_SEQUENCES[1])
})
