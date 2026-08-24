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
  buildSwitchImportUrl,
  SWITCH_IMPORT_APPS_BY_TARGET,
} from '../switch-import'

describe('API key switch imports', () => {
  test('builds the VarSwitch protocol URL with provider details', () => {
    const url = buildSwitchImportUrl({
      scheme: 'varswitch',
      app: 'claude',
      name: 'Team Claude',
      models: {
        model: 'claude-sonnet-4',
        haikuModel: '',
        opusModel: 'claude-opus-4',
      },
      apiKey: 'sk-secret',
      serverAddress: 'https://api.example.com',
    })

    const parsed = new URL(url)
    assert.equal(parsed.protocol, 'varswitch:')
    assert.equal(parsed.pathname, '/import')
    assert.deepEqual(Object.fromEntries(parsed.searchParams), {
      resource: 'provider',
      app: 'claude',
      name: 'Team Claude',
      endpoint: 'https://api.example.com',
      apiKey: 'sk-secret',
      model: 'claude-sonnet-4',
      opusModel: 'claude-opus-4',
      homepage: 'https://api.example.com',
      enabled: 'true',
    })
  })

  test('uses the versioned endpoint for Codex imports', () => {
    const url = buildSwitchImportUrl({
      scheme: 'ccswitch',
      app: 'codex',
      name: 'My Codex',
      models: { model: 'gpt-5-codex' },
      apiKey: 'sk-secret',
      serverAddress: 'https://api.example.com',
    })

    assert.equal(
      new URL(url).searchParams.get('endpoint'),
      'https://api.example.com/v1'
    )
  })

  test('supports Grok imports in VarSwitch without changing CC Switch apps', () => {
    assert.deepEqual(SWITCH_IMPORT_APPS_BY_TARGET['var-switch'], [
      'claude',
      'codex',
      'gemini',
      'grok',
    ])
    assert.deepEqual(SWITCH_IMPORT_APPS_BY_TARGET['cc-switch'], [
      'claude',
      'codex',
      'gemini',
    ])

    const url = buildSwitchImportUrl({
      scheme: 'varswitch',
      app: 'grok',
      name: 'Grok',
      models: { model: 'grok-4' },
      apiKey: 'sk-secret',
      serverAddress: 'https://api.example.com',
    })
    const params = new URL(url).searchParams

    assert.equal(params.get('app'), 'grok')
    assert.equal(params.get('model'), 'grok-4')
    assert.equal(params.get('endpoint'), 'https://api.example.com')
  })
})
