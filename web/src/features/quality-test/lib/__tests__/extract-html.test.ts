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
import { describe, expect, test } from 'vitest'

import {
  clampQualityTestFrameHeight,
  extractQualityTestHTML,
} from '../quality-test'

describe('extractQualityTestHTML', () => {
  test('markdown-fenced full document returns the document without fences or trailing prose', () => {
    const output = [
      'Here is the animation:',
      '```html',
      '<!DOCTYPE html><html><body><svg></svg></body></html>',
      '```',
      'Enjoy!',
    ].join('\n')

    expect(extractQualityTestHTML(output)).toBe(
      '<!DOCTYPE html><html><body><svg></svg></body></html>'
    )
  })

  test('text after the closing html tag is dropped from an unfenced reply', () => {
    expect(extractQualityTestHTML('<html><body>ok</body></html>\nDone.')).toBe(
      '<html><body>ok</body></html>'
    )
  })

  test('standalone svg fragment is accepted when no full document exists', () => {
    expect(extractQualityTestHTML('Sure: <svg viewBox="0 0 1 1"></svg>')).toBe(
      '<svg viewBox="0 0 1 1"></svg>'
    )
  })

  test('reply without any renderable markup returns an empty string', () => {
    expect(extractQualityTestHTML('I cannot draw that.')).toBe('')
  })
})

describe('clampQualityTestFrameHeight', () => {
  test('heights reported by the preview are bounded to the canvas limits', () => {
    expect(clampQualityTestFrameHeight(10)).toBe(320)
    expect(clampQualityTestFrameHeight(640.4)).toBe(640)
    expect(clampQualityTestFrameHeight(99999)).toBe(1400)
  })

  test('untrusted non-numeric or non-positive heights are ignored', () => {
    expect(clampQualityTestFrameHeight('abc')).toBeUndefined()
    expect(clampQualityTestFrameHeight(0)).toBeUndefined()
    expect(
      clampQualityTestFrameHeight(Number.POSITIVE_INFINITY)
    ).toBeUndefined()
  })
})
