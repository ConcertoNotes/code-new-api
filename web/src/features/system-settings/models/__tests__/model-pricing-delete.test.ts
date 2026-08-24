/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import assert from 'node:assert/strict'

import { describe, test } from 'vitest'

import {
  type ModelPricingMapValues,
  removeModelPricing,
} from '../model-pricing-delete'

describe('model pricing deletion', () => {
  test('removes the model from every pricing map while preserving other models', () => {
    const values = Object.fromEntries(
      [
        'ModelPrice',
        'ImageGenerationPrice',
        'VideoGenerationPrice',
        'ModelRatio',
        'CacheRatio',
        'CreateCacheRatio',
        'CompletionRatio',
        'ImageRatio',
        'AudioRatio',
        'AudioCompletionRatio',
        'BillingMode',
        'BillingExpr',
      ].map((field) => [
        field,
        JSON.stringify({ target: { configured: true }, retained: 1 }),
      ])
    ) as ModelPricingMapValues

    const result = removeModelPricing(values, 'target')

    for (const value of Object.values(result)) {
      assert.deepEqual(JSON.parse(value), { retained: 1 })
    }
  })
})
