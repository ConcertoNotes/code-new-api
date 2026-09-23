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

import { PELICAN_PROMPT } from '../../constants'
import type { QualityTestGroupOption, QualityTestPrompt } from '../../types'
import { matchQualityTestPreset } from '../quality-test'
import {
  filterQualityTestChannels,
  resolveQualityTestEffort,
  resolveQualityTestModel,
} from '../selection'

const group: QualityTestGroupOption = {
  name: 'vip',
  channels: [
    {
      id: 3,
      name: 'codex-pool',
      type: 57,
      status: 1,
      models: ['gpt-5-codex'],
      default_endpoint: 'openai-response',
    },
    {
      id: 12,
      name: 'claude-main',
      type: 14,
      status: 2,
      models: ['claude-opus', 'claude-sonnet'],
      default_endpoint: 'anthropic',
    },
  ],
}

describe('filterQualityTestChannels', () => {
  test('empty search lists every channel of the selected group', () => {
    expect(
      filterQualityTestChannels(group, '  ').map((item) => item.id)
    ).toEqual([3, 12])
  })

  test('search matches channel name, exact id with optional hash, or channel type', () => {
    expect(
      filterQualityTestChannels(group, 'CLAUDE').map((item) => item.id)
    ).toEqual([12])
    expect(
      filterQualityTestChannels(group, '#3').map((item) => item.id)
    ).toEqual([3])
    expect(
      filterQualityTestChannels(group, 'anthropic').map((item) => item.id)
    ).toEqual([12])
  })

  test('missing group yields no channels', () => {
    expect(filterQualityTestChannels(undefined, '')).toEqual([])
  })
})

describe('resolveQualityTestEffort', () => {
  test('keeps the current effort when the endpoint supports it', () => {
    expect(resolveQualityTestEffort(['', 'low', 'max'], 'max')).toBe('max')
  })

  test('unsupported effort falls back to high, then to the model default', () => {
    expect(resolveQualityTestEffort(['', 'low', 'high'], 'xhigh')).toBe('high')
    expect(resolveQualityTestEffort([''], 'high')).toBe('')
  })
})

describe('resolveQualityTestModel', () => {
  test('falls back to the first channel model when the current one is not offered', () => {
    expect(resolveQualityTestModel(group.channels[1], 'gpt-5')).toBe(
      'claude-opus'
    )
    expect(resolveQualityTestModel(group.channels[1], 'claude-sonnet')).toBe(
      'claude-sonnet'
    )
    expect(resolveQualityTestModel(undefined, 'claude-opus')).toBe('')
  })
})

describe('matchQualityTestPreset', () => {
  const custom: QualityTestPrompt = {
    id: 9,
    name: 'my pelican',
    prompt: PELICAN_PROMPT,
    usage_count: 0,
    created_at: 1,
    updated_at: 1,
  }

  test('a custom preset with identical text wins over the built-in preset', () => {
    const match = matchQualityTestPreset(PELICAN_PROMPT, [custom])
    expect(match.kind === 'custom' && match.preset.id).toBe(9)
  })

  test('built-in prompt text maps back to its preset key', () => {
    expect(matchQualityTestPreset(PELICAN_PROMPT, [])).toMatchObject({
      kind: 'builtin',
      key: 'pelican',
    })
  })

  test('edited prompt text is treated as hand-typed', () => {
    expect(matchQualityTestPreset(`${PELICAN_PROMPT}!`, [custom])).toEqual({
      kind: 'none',
    })
  })
})
