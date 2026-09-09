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

import { formatModelsArray } from '../model-mapping-validation'
import {
  applyNormalizedCategorySelection,
  hasNormalizedModel,
  isNormalizedCategorySelected,
  syncManualModelSelectionWithIgnoredList,
  toggleNormalizedModel,
} from '../upstream-update-utils'

describe('manual channel model selection', () => {
  test('unchecking a fetched model still removes the saved selection when names differ only by whitespace', () => {
    const selected = toggleNormalizedModel(
      ['claude-3-opus', 'claude-3-sonnet'],
      ' claude-3-opus '
    )

    expect(selected).toEqual(['claude-3-sonnet'])
    expect(hasNormalizedModel(selected, 'claude-3-opus')).toBe(false)
  })

  test('unchecking a category removes every matching saved model even when names are not identical strings', () => {
    const selected = applyNormalizedCategorySelection(
      ['claude-3-opus', 'gpt-4o'],
      [' claude-3-opus '],
      false
    )

    expect(selected).toEqual(['gpt-4o'])
    expect(isNormalizedCategorySelected(selected, ['claude-3-opus'])).toBe(
      false
    )
  })

  test('removed models stay ignored so auto-sync cannot add them back after refresh', () => {
    const ignored = syncManualModelSelectionWithIgnoredList(
      ['gpt-4o', 'claude-3-opus', 'claude-3-sonnet'],
      ['gpt-4o'],
      []
    )

    expect(ignored).toEqual(['claude-3-opus', 'claude-3-sonnet'])
  })

  test('re-adding a previously removed model clears only that exact ignore entry', () => {
    const ignored = syncManualModelSelectionWithIgnoredList(
      ['gpt-4o'],
      ['gpt-4o', 'claude-3-opus'],
      ['claude-3-opus', 'regex:^sora-.*$']
    )

    expect(ignored).toEqual(['regex:^sora-.*$'])
  })

  test('formatModelsArray trims duplicates before the form is saved', () => {
    expect(formatModelsArray([' gpt-4o ', 'gpt-4o', ' claude-3-opus'])).toBe(
      'gpt-4o,claude-3-opus'
    )
  })
})
