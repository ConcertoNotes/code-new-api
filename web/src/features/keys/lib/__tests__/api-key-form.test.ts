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
  API_KEY_FORM_DEFAULT_VALUES,
  transformApiKeyToFormDefaults,
  transformFormDataToPayload,
} from '../api-key-form'

describe('API key fallback groups', () => {
  test('preserves fallback group selection order in the API payload', () => {
    const payload = transformFormDataToPayload({
      ...API_KEY_FORM_DEFAULT_VALUES,
      group: 'primary',
      fallback_groups: ['backup-b', 'backup-a'],
    })

    assert.deepEqual(payload.fallback_groups, ['backup-b', 'backup-a'])
  })

  test('clears fallback groups when auto group routing is selected', () => {
    const payload = transformFormDataToPayload({
      ...API_KEY_FORM_DEFAULT_VALUES,
      group: 'auto',
      fallback_groups: ['backup'],
    })

    assert.deepEqual(payload.fallback_groups, [])
  })

  test('restores persisted fallback group order when editing', () => {
    const values = transformApiKeyToFormDefaults({
      id: 1,
      name: 'ordered-key',
      key: 'masked',
      status: 1,
      remain_quota: 0,
      used_quota: 0,
      unlimited_quota: true,
      expired_time: -1,
      created_time: 1,
      accessed_time: 1,
      group: 'primary',
      fallback_groups: ['backup-b', 'backup-a'],
      auto_groups: null,
      cross_group_retry: false,
      model_limits_enabled: false,
      model_limits: '',
      allow_ips: '',
    })

    assert.deepEqual(values.fallback_groups, ['backup-b', 'backup-a'])
  })
})
