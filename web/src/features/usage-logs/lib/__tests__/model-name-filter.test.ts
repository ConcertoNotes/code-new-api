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

import { buildSearchParams } from '../filter'
import { buildApiParams, buildModelNameFilter } from '../utils'

describe('buildModelNameFilter', () => {
  test('wraps the keyword in wildcards for fuzzy mode', () => {
    expect(buildModelNameFilter('gpt', 'fuzzy')).toBe('%gpt%')
  })

  test('keeps the input as-is for exact mode', () => {
    expect(buildModelNameFilter('gpt-4o', 'exact')).toBe('gpt-4o')
  })

  test('defaults to exact semantics without a mode', () => {
    expect(buildModelNameFilter('gpt-4o', undefined)).toBe('gpt-4o')
  })

  test('strips user-typed wildcards in fuzzy mode', () => {
    expect(buildModelNameFilter('%gpt%', 'fuzzy')).toBe('%gpt%')
    expect(buildModelNameFilter('g%pt', 'fuzzy')).toBe('%gpt%')
  })

  test('falls back to exact for fuzzy keywords below the backend minimum length', () => {
    expect(buildModelNameFilter('g', 'fuzzy')).toBe('g')
    expect(buildModelNameFilter('%g', 'fuzzy')).toBe('%g')
  })

  test('trims surrounding whitespace', () => {
    expect(buildModelNameFilter('  gpt-4o  ', 'exact')).toBe('gpt-4o')
    expect(buildModelNameFilter('  gpt  ', 'fuzzy')).toBe('%gpt%')
  })

  test('returns undefined for empty input', () => {
    expect(buildModelNameFilter('', 'fuzzy')).toBeUndefined()
    expect(buildModelNameFilter(undefined, 'fuzzy')).toBeUndefined()
  })
})

describe('buildApiParams model handling', () => {
  const baseConfig = {
    page: 1,
    pageSize: 100,
    isAdmin: false,
    searchParams: {} as Record<string, unknown>,
    columnFilters: [] as Array<{ id: string; value: unknown }>,
  }

  test('omits model_name when no model is set', () => {
    expect(buildApiParams(baseConfig).model_name).toBeUndefined()
  })

  test('fuzzy mode sends a wildcard pattern', () => {
    const params = buildApiParams({
      ...baseConfig,
      searchParams: { model: 'gpt', modelMatch: 'fuzzy' },
    })
    expect(params.model_name).toBe('%gpt%')
  })

  test('exact mode sends the raw model name', () => {
    const params = buildApiParams({
      ...baseConfig,
      searchParams: { model: 'gpt-4o', modelMatch: 'exact' },
    })
    expect(params.model_name).toBe('gpt-4o')
  })

  test('treats a missing modelMatch as exact (legacy URLs keep old semantics)', () => {
    const params = buildApiParams({
      ...baseConfig,
      searchParams: { model: 'gpt' },
    })
    expect(params.model_name).toBe('gpt')
  })

  test('applies fuzzy wrapping to column filter overrides too', () => {
    const params = buildApiParams({
      ...baseConfig,
      searchParams: { modelMatch: 'fuzzy' },
      columnFilters: [{ id: 'model_name', value: 'claude' }],
    })
    expect(params.model_name).toBe('%claude%')
  })
})

describe('buildSearchParams model match mode', () => {
  test('defaults the URL param to fuzzy', () => {
    const search = buildSearchParams(
      { model: 'gpt', startTime: new Date(0), endTime: new Date(0) },
      'common'
    )
    expect(search.modelMatch).toBe('fuzzy')
  })

  test('preserves an explicit exact mode', () => {
    const search = buildSearchParams(
      { model: 'gpt', modelMatch: 'exact' },
      'common'
    )
    expect(search.modelMatch).toBe('exact')
  })
})
