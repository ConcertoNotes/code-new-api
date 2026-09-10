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
  applyGroupRenamesToJson,
  detectGroupRenames,
  isGroupRenameMap,
} from '../utils'

describe('group rename helpers', () => {
  test('detects a single old-to-new group rename', () => {
    expect(
      detectGroupRenames('{"default":1,"vip":1}', '{"default":1,"gold":1}')
    ).toEqual({ vip: 'gold' })
    expect(
      detectGroupRenames('{"default":1,"vip":1}', '{"default":1,"vip":1,"gold":1}')
    ).toEqual({})
  })

  test('rejects submit events that are not rename maps', () => {
    expect(isGroupRenameMap({ vip: 'gold' })).toBe(true)
    expect(isGroupRenameMap({ preventDefault: () => undefined })).toBe(false)
    expect(isGroupRenameMap(undefined)).toBe(false)
  })

  test('remaps leftover group names in related JSON fields', () => {
    expect(
      applyGroupRenamesToJson('{"vip":"VIP","default":"Default"}', { vip: 'gold' }, 'map')
    ).toBe('{"default":"Default","gold":"VIP"}')
    expect(
      applyGroupRenamesToJson('["vip","default"]', { vip: 'gold' }, 'list')
    ).toBe('["gold","default"]')
    expect(
      applyGroupRenamesToJson(
        '{"vip":{"+:vip":"add","-:default":"remove"}}',
        { vip: 'gold' },
        'special'
      )
    ).toBe('{"gold":{"+:gold":"add","-:default":"remove"}}')
  })
})
