import { describe, expect, it } from 'vitest'

import { normalizeBlacklistEntries } from '../blacklist-utils'

describe('basic authentication blacklist fields', () => {
  it('trims, removes blank lines, and deduplicates entries', () => {
    expect(normalizeBlacklistEntries(' A@example.com\n\na@example.com \nB@example.com ')).toBe(
      'a@example.com\nb@example.com'
    )
  })
})
