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
import { safeJsonParse } from '../utils/json-parser'

export type ModelPricingMapValues = {
  ModelPrice: string
  ImageGenerationPrice: string
  VideoGenerationPrice: string
  ModelRatio: string
  CacheRatio: string
  CreateCacheRatio: string
  CompletionRatio: string
  ImageRatio: string
  AudioRatio: string
  AudioCompletionRatio: string
  BillingMode: string
  BillingExpr: string
}

const modelPricingMapFields = [
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
] as const satisfies ReadonlyArray<keyof ModelPricingMapValues>

export function removeModelPricing(
  values: ModelPricingMapValues,
  modelName: string
): ModelPricingMapValues {
  const nextValues = { ...values }

  for (const field of modelPricingMapFields) {
    const valueMap = safeJsonParse<Record<string, unknown>>(values[field], {
      fallback: {},
      silent: true,
    })
    delete valueMap[modelName]
    nextValues[field] = JSON.stringify(valueMap, null, 2)
  }

  return nextValues
}
