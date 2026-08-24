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
import { describe, test } from 'node:test'

import {
  createVideoResolutionPriceRows,
  hasDuplicateVideoResolution,
  videoResolutionPriceRowsToRecord,
} from '../video-resolution-pricing'

describe('video resolution pricing drafts', () => {
  test('starts with 480p, 720p, and 1080p while preserving custom prices', () => {
    const rows = createVideoResolutionPriceRows({
      '720p': 0.4,
      '768P': 0.5,
      '4k': 1.2,
    })

    assert.deepEqual(
      rows.map((row) => [row.resolution, row.price, row.preset]),
      [
        ['480p', '', true],
        ['720p', '0.4', true],
        ['1080p', '', true],
        ['768p', '0.5', false],
        ['4k', '1.2', false],
      ]
    )
  })

  test('normalizes aliases and excludes rows without prices when serializing', () => {
    const rows = createVideoResolutionPriceRows()
    rows[0] = { ...rows[0], resolution: '854x480', price: '0.2' }
    rows.push({
      id: 'custom-768p',
      resolution: ' 768P ',
      price: '0.5',
      preset: false,
    })

    assert.deepEqual(videoResolutionPriceRowsToRecord(rows), {
      '480p': '0.2',
      '768p': '0.5',
    })
  })

  test('detects duplicate aliases before saving', () => {
    const rows = createVideoResolutionPriceRows()
    rows.push({
      id: 'custom-720p',
      resolution: '1280x720',
      price: '0.5',
      preset: false,
    })

    assert.equal(hasDuplicateVideoResolution(rows), true)
  })
})
