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

import type { ChannelProfitRow } from '../../types'
import {
  ALL_GROUPS_FILTER,
  aggregateProfitByChannel,
  buildProfitCsv,
  collectProfitGroups,
  computeProfitRate,
  filterProfitRows,
  formatRatio,
  getTimezoneOffsetSeconds,
} from '../profit'

function makeRow(overrides: Partial<ChannelProfitRow>): ChannelProfitRow {
  return {
    channel_id: 1,
    channel_name: 'OpenAI',
    channel_type: 1,
    channel_status: 1,
    channel_exists: true,
    group: 'default',
    sell_ratio: 1.5,
    upstream_ratio: 1,
    requests: 10,
    quota: 1500,
    official_quota: 1000,
    cost_quota: 1000,
    profit_quota: 500,
    last_used_at: 1_700_000_000,
    ...overrides,
  }
}

describe('computeProfitRate', () => {
  test('returns percentage when revenue is positive', () => {
    expect(computeProfitRate(500, 1500)).toBeCloseTo(33.333, 2)
  })

  test('returns null when revenue is zero or invalid', () => {
    expect(computeProfitRate(0, 0)).toBeNull()
    expect(computeProfitRate(10, -5)).toBeNull()
    expect(computeProfitRate(10, Number.NaN)).toBeNull()
  })

  test('returns negative percentage when running at a loss', () => {
    expect(computeProfitRate(-300, 1000)).toBe(-30)
  })
})

describe('formatRatio', () => {
  test('keeps up to four decimals and strips trailing zeros', () => {
    expect(formatRatio(1)).toBe('1')
    expect(formatRatio(1.5)).toBe('1.5')
    expect(formatRatio(0.123456)).toBe('0.1235')
  })

  test('renders dash for non-finite values', () => {
    expect(formatRatio(Number.NaN)).toBe('-')
    expect(formatRatio(Number.POSITIVE_INFINITY)).toBe('-')
  })
})

describe('getTimezoneOffsetSeconds', () => {
  test('converts minutes west of UTC into seconds east of UTC', () => {
    const fake = { getTimezoneOffset: () => -480 } as unknown as Date
    expect(getTimezoneOffsetSeconds(fake)).toBe(8 * 3600)
  })
})

describe('filterProfitRows', () => {
  const rows = [
    makeRow({ channel_id: 1, channel_name: 'OpenAI', group: 'default' }),
    makeRow({ channel_id: 1, channel_name: 'OpenAI', group: 'vip' }),
    makeRow({
      channel_id: 2,
      channel_name: 'Claude',
      group: 'default',
      channel_status: 2,
    }),
    makeRow({
      channel_id: 3,
      channel_name: '#3',
      group: 'default',
      channel_exists: false,
    }),
  ]

  test('returns every row when no filter is set', () => {
    expect(
      filterProfitRows(rows, {
        search: '',
        status: 'all',
        group: ALL_GROUPS_FILTER,
      })
    ).toHaveLength(4)
  })

  test('matches keyword against channel name, id and group case-insensitively', () => {
    expect(
      filterProfitRows(rows, {
        search: 'openai',
        status: 'all',
        group: ALL_GROUPS_FILTER,
      })
    ).toHaveLength(2)
    expect(
      filterProfitRows(rows, {
        search: '#2',
        status: 'all',
        group: ALL_GROUPS_FILTER,
      })
    ).toHaveLength(1)
  })

  test('enabled filter keeps only existing enabled channels', () => {
    const result = filterProfitRows(rows, {
      search: '',
      status: 'enabled',
      group: ALL_GROUPS_FILTER,
    })
    expect(result.map((row) => row.channel_id)).toEqual([1, 1])
  })

  test('disabled filter keeps disabled and deleted channels', () => {
    const result = filterProfitRows(rows, {
      search: '',
      status: 'disabled',
      group: ALL_GROUPS_FILTER,
    })
    expect(result.map((row) => row.channel_id)).toEqual([2, 3])
  })

  test('group filter keeps only the selected group', () => {
    const result = filterProfitRows(rows, {
      search: '',
      status: 'all',
      group: 'vip',
    })
    expect(result).toHaveLength(1)
    expect(result[0].group).toBe('vip')
  })
})

describe('collectProfitGroups', () => {
  test('returns sorted unique groups', () => {
    expect(
      collectProfitGroups([
        makeRow({ group: 'vip' }),
        makeRow({ group: 'default' }),
        makeRow({ group: 'vip' }),
      ])
    ).toEqual(['default', 'vip'])
  })

  test('returns empty list for no rows', () => {
    expect(collectProfitGroups([])).toEqual([])
  })
})

describe('aggregateProfitByChannel', () => {
  test('merges multiple groups of one channel and sorts by profit desc', () => {
    const result = aggregateProfitByChannel([
      makeRow({ channel_id: 1, profit_quota: 100 }),
      makeRow({ channel_id: 2, channel_name: 'Claude', profit_quota: 500 }),
      makeRow({ channel_id: 1, group: 'vip', profit_quota: 250 }),
    ])
    expect(result).toEqual([
      { channel_id: 2, channel_name: 'Claude', profit_quota: 500 },
      { channel_id: 1, channel_name: 'OpenAI', profit_quota: 350 },
    ])
  })
})

describe('buildProfitCsv', () => {
  test('starts with BOM, quotes commas and formats amounts via callbacks', () => {
    const csv = buildProfitCsv(
      [
        makeRow({ channel_name: 'Open, AI', last_used_at: 1_700_000_000 }),
        makeRow({ channel_id: 2, quota: 0, profit_quota: 0, last_used_at: 0 }),
      ],
      {
        headers: ['id', 'name'],
        formatAmount: (quota) => `$${quota}`,
        formatTime: (timestamp) => `T${timestamp}`,
      }
    )
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('﻿id,name')
    expect(lines[1]).toBe(
      '1,"Open, AI",default,1,1.5,10,$1500,$1000,$500,33.3%,T1700000000'
    )
    expect(lines[2]).toBe('2,OpenAI,default,1,1.5,10,$0,$1000,$0,-,-')
  })
})
