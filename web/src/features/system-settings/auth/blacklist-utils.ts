export function normalizeBlacklistEntries(value: string): string {
  const entries = value
    .split(/\r?\n/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  return [...new Set(entries)].join('\n')
}
