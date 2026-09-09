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
export function normalizeModelList(models: unknown[] = []): string[] {
  return [
    ...new Set(
      (models || []).map((model) => String(model || '').trim()).filter(Boolean)
    ),
  ]
}

export function hasNormalizedModel(
  models: readonly string[],
  model: string
): boolean {
  const normalized = String(model || '').trim()
  if (!normalized) return false
  return models.some((item) => String(item || '').trim() === normalized)
}

export function toggleNormalizedModel(
  models: readonly string[],
  model: string
): string[] {
  const normalized = String(model || '').trim()
  if (!normalized) return [...models]
  if (hasNormalizedModel(models, normalized)) {
    return models.filter((item) => String(item || '').trim() !== normalized)
  }
  return [...models, normalized]
}

export function applyNormalizedCategorySelection(
  selected: readonly string[],
  categoryModels: readonly string[],
  isChecked: boolean
): string[] {
  if (isChecked) {
    const next = [...selected]
    for (const model of categoryModels) {
      const normalized = String(model || '').trim()
      if (!normalized || hasNormalizedModel(next, normalized)) continue
      next.push(normalized)
    }
    return next
  }

  const categorySet = new Set(
    categoryModels.map((model) => String(model || '').trim()).filter(Boolean)
  )
  return selected.filter(
    (model) => !categorySet.has(String(model || '').trim())
  )
}

export function isNormalizedCategorySelected(
  selected: readonly string[],
  categoryModels: readonly string[]
): boolean {
  return (
    categoryModels.length > 0 &&
    categoryModels.every((model) => hasNormalizedModel(selected, model))
  )
}

export function syncManualModelSelectionWithIgnoredList(
  originModels: unknown[] = [],
  nextModels: unknown[] = [],
  ignoredModels: unknown[] = []
): string[] {
  const nextSet = new Set(normalizeModelList(nextModels))
  return [
    ...new Set([
      ...normalizeModelList(ignoredModels),
      ...normalizeModelList(originModels),
    ]),
  ].filter((model) => !nextSet.has(model))
}

export function parseUpstreamUpdateMeta(settings: unknown): {
  enabled: boolean
  pendingAddModels: string[]
  pendingRemoveModels: string[]
} {
  let parsed: Record<string, unknown> | null = null
  if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
    parsed = settings as Record<string, unknown>
  } else if (typeof settings === 'string') {
    try {
      parsed = JSON.parse(settings)
    } catch {
      parsed = null
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { enabled: false, pendingAddModels: [], pendingRemoveModels: [] }
  }

  return {
    enabled: parsed.upstream_model_update_check_enabled === true,
    pendingAddModels: normalizeModelList(
      (parsed.upstream_model_update_last_detected_models as unknown[]) || []
    ),
    pendingRemoveModels: normalizeModelList(
      (parsed.upstream_model_update_last_removed_models as unknown[]) || []
    ),
  }
}
