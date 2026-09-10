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
export function formatJsonForTextarea(value: string) {
  if (!value || !value.trim()) {
    return ''
  }

  try {
    const parsed = JSON.parse(value)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return value
  }
}

export function normalizeJsonString(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  try {
    const parsed = JSON.parse(trimmed)
    return JSON.stringify(parsed)
  } catch {
    return trimmed
  }
}

export function isGroupRenameMap(
  value: unknown
): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const entries = Object.entries(value)
  return (
    entries.length > 0 &&
    entries.every(
      ([oldName, newName]) =>
        typeof oldName === 'string' &&
        oldName.length > 0 &&
        typeof newName === 'string' &&
        newName.length > 0
    )
  )
}

export function detectGroupRenames(
  oldJson: string,
  newJson: string
): Record<string, string> {
  const oldMap = parseJsonRecord(oldJson)
  const newMap = parseJsonRecord(newJson)
  if (!oldMap || !newMap) return {}
  const deleted = Object.keys(oldMap).filter((key) => !Object.hasOwn(newMap, key))
  const added = Object.keys(newMap).filter((key) => !Object.hasOwn(oldMap, key))
  if (deleted.length === 1 && added.length === 1) {
    return { [deleted[0]]: added[0] }
  }
  return {}
}

export function applyGroupRenamesToJson(
  json: string,
  renames: Record<string, string>,
  kind: 'map' | 'nested' | 'list' | 'special'
): string {
  if (!json.trim() || Object.keys(renames).length === 0) {
    return json
  }
  try {
    const parsed = JSON.parse(json) as unknown
    if (kind === 'list') {
      if (!Array.isArray(parsed)) return json
      const seen = new Set<string>()
      const next: string[] = []
      for (const item of parsed) {
        if (typeof item !== 'string') continue
        const value = renames[item] ?? item
        if (seen.has(value)) continue
        seen.add(value)
        next.push(value)
      }
      return JSON.stringify(next)
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json
    }
    if (kind === 'map') {
      return JSON.stringify(
        remapRecordKeys(parsed as Record<string, unknown>, renames)
      )
    }
    const nested = remapRecordKeys(
      parsed as Record<string, Record<string, unknown>>,
      renames
    )
    for (const key of Object.keys(nested)) {
      const inner = nested[key]
      if (!inner || typeof inner !== 'object' || Array.isArray(inner)) continue
      nested[key] =
        kind === 'special'
          ? remapSpecialUsableKeys(inner as Record<string, unknown>, renames)
          : remapRecordKeys(inner as Record<string, unknown>, renames)
    }
    return JSON.stringify(nested)
  } catch {
    return json
  }
}

function parseJsonRecord(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value || '{}') as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function remapRecordKeys<T>(
  record: Record<string, T>,
  renames: Record<string, string>
): Record<string, T> {
  const next = { ...record }
  const pending: Record<string, T> = {}
  for (const [oldName, newName] of Object.entries(renames)) {
    if (!Object.hasOwn(next, oldName)) continue
    pending[newName] = next[oldName]
    delete next[oldName]
  }
  for (const [newName, value] of Object.entries(pending)) {
    if (!Object.hasOwn(next, newName)) {
      next[newName] = value
    }
  }
  return next
}

function remapSpecialUsableKeys(
  record: Record<string, unknown>,
  renames: Record<string, string>
): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    let prefix = ''
    let name = key
    if (key.startsWith('-:')) {
      prefix = '-:'
      name = key.slice(2)
    } else if (key.startsWith('+:')) {
      prefix = '+:'
      name = key.slice(2)
    }
    const renamed = Object.hasOwn(renames, name) ? prefix + renames[name] : key
    if (!Object.hasOwn(next, renamed)) {
      next[renamed] = value
    }
  }
  return next
}

type JsonValidationOptions = {
  allowEmpty?: boolean
  predicate?: (value: unknown) => boolean
  predicateMessage?: string
}

export type JsonValidationError = {
  type: 'required' | 'structure' | 'syntax'
  line?: number
  column?: number
  position?: number
  missingCommaLine?: number
}

function extractErrorPosition(
  error: unknown,
  jsonString: string
): { line?: number; column?: number; position?: number } {
  if (!(error instanceof Error)) return {}

  const message = error.message

  // Format 1: "Unexpected token } in JSON at position 15"
  const positionMatch = message.match(/at position (\d+)/i)
  if (positionMatch) {
    const position = parseInt(positionMatch[1], 10)
    const lines = jsonString.substring(0, position).split('\n')
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
      position,
    }
  }

  // Format 2: "JSON.parse: ... at line 2 column 3"
  const lineColMatch = message.match(/at line (\d+) column (\d+)/i)
  if (lineColMatch) {
    return {
      line: parseInt(lineColMatch[1], 10),
      column: parseInt(lineColMatch[2], 10),
    }
  }

  return {}
}

function buildSyntaxError(
  error: unknown,
  jsonString: string
): JsonValidationError {
  if (!(error instanceof Error)) {
    return {
      type: 'syntax',
    } satisfies JsonValidationError
  }

  const position = extractErrorPosition(error, jsonString)
  const message = error.message

  // Check if it's a "missing comma" type error
  const isMissingCommaError =
    message.includes("Expected ','") ||
    message.includes('Expected property name') ||
    message.includes('Unexpected string')

  const missingCommaLine =
    isMissingCommaError && position.line && position.line > 1
      ? position.line - 1
      : undefined

  return {
    type: 'syntax',
    ...position,
    missingCommaLine,
  } satisfies JsonValidationError
}

function formatErrorMessage(error: unknown, jsonString: string): string {
  if (!(error instanceof Error)) return 'Invalid JSON'

  const position = extractErrorPosition(error, jsonString)
  const message = error.message
  const syntaxError = buildSyntaxError(error, jsonString)

  if (position.line && position.column) {
    let hint = ''
    if (syntaxError.missingCommaLine) {
      hint = ` (check line ${syntaxError.missingCommaLine} for missing comma)`
    }
    return `Error at line ${position.line}, column ${position.column}: ${message}${hint}`
  }

  if (position.position !== undefined) {
    return `Error at position ${position.position}: ${message}`
  }

  return message
}

export function validateJsonString(
  value: string,
  options: JsonValidationOptions = {}
) {
  const { allowEmpty = true, predicate, predicateMessage } = options
  const trimmed = value.trim()

  if (!trimmed) {
    return {
      valid: allowEmpty,
      message: allowEmpty ? undefined : 'Value is required',
      error: allowEmpty
        ? undefined
        : ({
            type: 'required',
          } satisfies JsonValidationError),
    }
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (predicate && !predicate(parsed)) {
      return {
        valid: false,
        message: predicateMessage || 'JSON structure is invalid',
        error: {
          type: 'structure',
        } satisfies JsonValidationError,
      }
    }

    return { valid: true }
  } catch (error: unknown) {
    return {
      valid: false,
      message: formatErrorMessage(error, trimmed),
      error: buildSyntaxError(error, trimmed),
    }
  }
}
