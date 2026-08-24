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

export const DEFAULT_VIDEO_RESOLUTIONS = ['480p', '720p', '1080p'] as const
const defaultVideoResolutionSet = new Set<string>(DEFAULT_VIDEO_RESOLUTIONS)

export type VideoResolutionPriceRow = {
  id: string
  resolution: string
  price: string
  preset: boolean
}

export function normalizeVideoResolution(resolution: string): string {
  const normalized = resolution.trim().toLowerCase()
  if (['480p', '854x480', '480x854'].includes(normalized)) return '480p'
  if (['720p', '1280x720', '720x1280'].includes(normalized)) return '720p'
  if (['1080p', '1920x1080', '1080x1920'].includes(normalized)) return '1080p'
  if (['4k', '2160p', '3840x2160', '2160x3840'].includes(normalized)) {
    return '4k'
  }
  return normalized
}

export function createVideoResolutionPriceRows(
  prices?: Record<string, string | number>
): VideoResolutionPriceRow[] {
  const normalizedPrices = new Map<string, string>()
  for (const [resolution, price] of Object.entries(prices || {})) {
    const normalizedResolution = normalizeVideoResolution(resolution)
    if (normalizedResolution) {
      normalizedPrices.set(normalizedResolution, String(price))
    }
  }

  const rows: VideoResolutionPriceRow[] = DEFAULT_VIDEO_RESOLUTIONS.map(
    (resolution) => ({
      id: `preset-${resolution}`,
      resolution,
      price: normalizedPrices.get(resolution) || '',
      preset: true,
    })
  )

  for (const [resolution, price] of normalizedPrices) {
    if (defaultVideoResolutionSet.has(resolution)) continue
    rows.push({
      id: `saved-${rows.length}-${resolution}`,
      resolution,
      price,
      preset: false,
    })
  }

  return rows
}

export function videoResolutionPriceRowsToRecord(
  rows: VideoResolutionPriceRow[]
): Record<string, string> {
  return Object.fromEntries(
    rows
      .map(
        (row) => [normalizeVideoResolution(row.resolution), row.price] as const
      )
      .filter(([resolution, price]) => resolution !== '' && price !== '')
  )
}

export function hasConfiguredVideoResolutionPrice(
  rows: VideoResolutionPriceRow[]
): boolean {
  return rows.some((row) => {
    if (!normalizeVideoResolution(row.resolution) || row.price === '') {
      return false
    }
    const price = Number(row.price)
    return Number.isFinite(price) && price >= 0
  })
}

export function hasDuplicateVideoResolution(
  rows: VideoResolutionPriceRow[]
): boolean {
  const resolutions = rows
    .map((row) => normalizeVideoResolution(row.resolution))
    .filter(Boolean)
  return new Set(resolutions).size !== resolutions.length
}
