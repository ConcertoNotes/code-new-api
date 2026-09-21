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
import { describe, expect, it } from 'vitest'

import type { LogOtherData } from '../../types'
import {
  classifyUpstreamModel,
  getUpstreamModelAudit,
  normalizeModelVariant,
} from '../model-audit'

describe('normalizeModelVariant', () => {
  it('strips -latest and dated snapshot suffixes', () => {
    expect(normalizeModelVariant('gpt-4o-latest')).toBe('gpt-4o')
    expect(normalizeModelVariant('gpt-4o-2024-08-06')).toBe('gpt-4o')
    expect(normalizeModelVariant('claude-sonnet-4-5-20250929')).toBe(
      'claude-sonnet-4-5'
    )
    expect(normalizeModelVariant('  GPT-4.1  ')).toBe('gpt-4.1')
  })
})

describe('classifyUpstreamModel', () => {
  it('returns unknown when the upstream declared no model', () => {
    expect(classifyUpstreamModel('gpt-4o', '')).toBe('unknown')
  })

  it('returns match for case-insensitive identical names', () => {
    expect(classifyUpstreamModel('GPT-4o', 'gpt-4o')).toBe('match')
  })

  it('returns variant when only an alias suffix differs', () => {
    expect(classifyUpstreamModel('gpt-4o', 'gpt-4o-2024-08-06')).toBe('variant')
    expect(
      classifyUpstreamModel('claude-sonnet-4-5', 'claude-sonnet-4-5-20250929')
    ).toBe('variant')
  })

  it('returns mismatch for a different model or an empty sent model', () => {
    expect(classifyUpstreamModel('gpt-4o', 'gpt-4o-mini')).toBe('mismatch')
    expect(classifyUpstreamModel('', 'gpt-4o')).toBe('mismatch')
  })
})

describe('getUpstreamModelAudit', () => {
  it('returns null without admin_info or without an upstream response model', () => {
    expect(getUpstreamModelAudit('gpt-4o', null)).toBeNull()
    expect(getUpstreamModelAudit('gpt-4o', { admin_info: {} })).toBeNull()
  })

  it('prefers sent_model over the mapped and requested names', () => {
    const other: LogOtherData = {
      upstream_model_name: 'mapped-model',
      admin_info: {
        sent_model: 'gpt-4o',
        upstream_response_model: 'gpt-4o-mini',
        upstream_model_mismatch: true,
      },
    }

    expect(getUpstreamModelAudit('alias', other)).toEqual({
      status: 'mismatch',
      requestedModel: 'alias',
      sentModel: 'gpt-4o',
      responseModel: 'gpt-4o-mini',
    })
  })

  it('trusts a backend match verdict even when the names differ textually', () => {
    const other: LogOtherData = {
      admin_info: {
        upstream_response_model: 'gpt-4o ',
        upstream_model_mismatch: false,
      },
    }

    expect(getUpstreamModelAudit('gpt-4o', other)?.status).toBe('match')
  })

  it('downgrades a backend mismatch to variant for snapshot suffixes', () => {
    const other: LogOtherData = {
      admin_info: {
        upstream_response_model: 'gpt-4o-2024-08-06',
        upstream_model_mismatch: true,
      },
    }

    expect(getUpstreamModelAudit('gpt-4o', other)?.status).toBe('variant')
  })
})
