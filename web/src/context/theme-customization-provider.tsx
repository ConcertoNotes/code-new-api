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
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'

import { applyI18nSkin } from '@/i18n/skin'
import { getCookie, removeCookie, setCookie } from '@/lib/cookies'
import {
  CONTENT_LAYOUT_VALUES,
  type ContentLayout,
  DEFAULT_THEME_CUSTOMIZATION,
  resolveThemeFont,
  THEME_COOKIE_KEYS,
  THEME_FONT_VALUES,
  THEME_PRESET_VALUES,
  THEME_RADIUS_VALUES,
  THEME_SCALE_VALUES,
  THEME_SKIN_VALUES,
  type ThemeCustomization,
  type ThemeFont,
  type ThemePreset,
  type ThemeRadius,
  type ThemeScale,
  type ThemeSkin,
} from '@/lib/theme-customization'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

function readCookie<T extends string>(
  name: string,
  allowed: ReadonlySet<T>,
  fallback: T
): T {
  const value = getCookie(name)
  return value && allowed.has(value as T) ? (value as T) : fallback
}

function applyAttribute(name: string, value: string | null) {
  if (typeof document === 'undefined') return
  const body = document.body
  if (!body) return
  if (value === null) {
    body.removeAttribute(name)
  } else {
    body.setAttribute(name, value)
  }
}

type ThemeCustomizationContextType = {
  defaults: ThemeCustomization
  customization: ThemeCustomization
  setSkin: (skin: ThemeSkin) => void
  setPreset: (preset: ThemePreset) => void
  setFont: (font: ThemeFont) => void
  setRadius: (radius: ThemeRadius) => void
  setScale: (scale: ThemeScale) => void
  setContentLayout: (contentLayout: ContentLayout) => void
  resetCustomization: () => void
}

// Fallback used when a consumer renders outside the provider (e.g. an error
// route mounted before providers are ready, or stale HMR boundaries). Keeping
// it permissive prevents the whole tree from crashing — the UI just behaves
// like the defaults until the real provider re-mounts.
const FALLBACK_CONTEXT: ThemeCustomizationContextType = {
  defaults: DEFAULT_THEME_CUSTOMIZATION,
  customization: DEFAULT_THEME_CUSTOMIZATION,
  setSkin: () => {},
  setPreset: () => {},
  setFont: () => {},
  setRadius: () => {},
  setScale: () => {},
  setContentLayout: () => {},
  resetCustomization: () => {},
}

const ThemeCustomizationContext =
  createContext<ThemeCustomizationContextType>(FALLBACK_CONTEXT)

export function ThemeCustomizationProvider(props: {
  children: React.ReactNode
}) {
  const [skin, _setSkin] = useState<ThemeSkin>(() =>
    readCookie<ThemeSkin>(
      THEME_COOKIE_KEYS.skin,
      THEME_SKIN_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.skin
    )
  )
  const [preset, _setPreset] = useState<ThemePreset>(() =>
    readCookie<ThemePreset>(
      THEME_COOKIE_KEYS.preset,
      THEME_PRESET_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.preset
    )
  )
  const [font, _setFont] = useState<ThemeFont>(() =>
    readCookie<ThemeFont>(
      THEME_COOKIE_KEYS.font,
      THEME_FONT_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.font
    )
  )
  const [radius, _setRadius] = useState<ThemeRadius>(() =>
    readCookie<ThemeRadius>(
      THEME_COOKIE_KEYS.radius,
      THEME_RADIUS_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.radius
    )
  )
  const [scale, _setScale] = useState<ThemeScale>(() =>
    readCookie<ThemeScale>(
      THEME_COOKIE_KEYS.scale,
      THEME_SCALE_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.scale
    )
  )
  const [contentLayout, _setContentLayout] = useState<ContentLayout>(() =>
    readCookie<ContentLayout>(
      THEME_COOKIE_KEYS.contentLayout,
      CONTENT_LAYOUT_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.contentLayout
    )
  )

  // Mirror state to the <body> via data-* attributes so theme-presets.css can
  // override CSS variables at the right cascade layer.
  useLayoutEffect(() => {
    applyAttribute('data-theme-preset', preset)
  }, [preset])

  // 皮肤与颜色预设相互独立：lulu-site.css / lulu-controls.css 中的装饰规则
  // 只挂在 `data-theme-skin='lulu'` 上，颜色 token 仍由 `data-theme-preset` 决定。
  // 同时切换站点文案：原版皮肤使用上游 new-api 的原始措辞。
  useLayoutEffect(() => {
    applyAttribute('data-theme-skin', skin)
    applyI18nSkin(skin)
  }, [skin])

  // Font is the one axis where we resolve before writing the attribute:
  // the persisted preference may be `default`, but CSS works in terms of
  // the concrete `sans`/`serif` choice that should drive the cascade.
  // Resolving here (instead of in CSS via `:not()` selectors) keeps the
  // stylesheet to one simple `[data-theme-font='serif']` selector and lets
  // future presets opt into typography via `PRESET_DEFAULT_FONT` alone.
  useEffect(() => {
    applyAttribute('data-theme-font', resolveThemeFont(font, preset))
  }, [font, preset])

  useEffect(() => {
    applyAttribute(
      'data-theme-radius',
      radius === DEFAULT_THEME_CUSTOMIZATION.radius ? null : radius
    )
  }, [radius])

  useEffect(() => {
    applyAttribute(
      'data-theme-scale',
      scale === DEFAULT_THEME_CUSTOMIZATION.scale ? null : scale
    )
  }, [scale])

  useEffect(() => {
    applyAttribute('data-theme-content-layout', contentLayout)
  }, [contentLayout])

  const setSkin = useCallback((value: ThemeSkin) => {
    _setSkin(value)
    if (value === DEFAULT_THEME_CUSTOMIZATION.skin) {
      removeCookie(THEME_COOKIE_KEYS.skin)
    } else {
      setCookie(THEME_COOKIE_KEYS.skin, value, COOKIE_MAX_AGE)
    }
  }, [])

  const setPreset = useCallback((value: ThemePreset) => {
    _setPreset(value)
    if (value === DEFAULT_THEME_CUSTOMIZATION.preset) {
      removeCookie(THEME_COOKIE_KEYS.preset)
    } else {
      setCookie(THEME_COOKIE_KEYS.preset, value, COOKIE_MAX_AGE)
    }
  }, [])

  const setFont = useCallback((value: ThemeFont) => {
    _setFont(value)
    if (value === DEFAULT_THEME_CUSTOMIZATION.font) {
      removeCookie(THEME_COOKIE_KEYS.font)
    } else {
      setCookie(THEME_COOKIE_KEYS.font, value, COOKIE_MAX_AGE)
    }
  }, [])

  const setRadius = useCallback((value: ThemeRadius) => {
    _setRadius(value)
    if (value === DEFAULT_THEME_CUSTOMIZATION.radius) {
      removeCookie(THEME_COOKIE_KEYS.radius)
    } else {
      setCookie(THEME_COOKIE_KEYS.radius, value, COOKIE_MAX_AGE)
    }
  }, [])

  const setScale = useCallback((value: ThemeScale) => {
    _setScale(value)
    if (value === DEFAULT_THEME_CUSTOMIZATION.scale) {
      removeCookie(THEME_COOKIE_KEYS.scale)
    } else {
      setCookie(THEME_COOKIE_KEYS.scale, value, COOKIE_MAX_AGE)
    }
  }, [])

  const setContentLayout = useCallback((value: ContentLayout) => {
    _setContentLayout(value)
    if (value === DEFAULT_THEME_CUSTOMIZATION.contentLayout) {
      removeCookie(THEME_COOKIE_KEYS.contentLayout)
    } else {
      setCookie(THEME_COOKIE_KEYS.contentLayout, value, COOKIE_MAX_AGE)
    }
  }, [])

  const resetCustomization = useCallback(() => {
    setSkin(DEFAULT_THEME_CUSTOMIZATION.skin)
    setPreset(DEFAULT_THEME_CUSTOMIZATION.preset)
    setFont(DEFAULT_THEME_CUSTOMIZATION.font)
    setRadius(DEFAULT_THEME_CUSTOMIZATION.radius)
    setScale(DEFAULT_THEME_CUSTOMIZATION.scale)
    setContentLayout(DEFAULT_THEME_CUSTOMIZATION.contentLayout)
  }, [setSkin, setPreset, setFont, setRadius, setScale, setContentLayout])

  const value = useMemo<ThemeCustomizationContextType>(
    () => ({
      defaults: DEFAULT_THEME_CUSTOMIZATION,
      customization: { skin, preset, font, radius, scale, contentLayout },
      setSkin,
      setPreset,
      setFont,
      setRadius,
      setScale,
      setContentLayout,
      resetCustomization,
    }),
    [
      skin,
      preset,
      font,
      radius,
      scale,
      contentLayout,
      setSkin,
      setPreset,
      setFont,
      setRadius,
      setScale,
      setContentLayout,
      resetCustomization,
    ]
  )

  return (
    <ThemeCustomizationContext.Provider value={value}>
      {props.children}
    </ThemeCustomizationContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useThemeCustomization() {
  return useContext(ThemeCustomizationContext)
}
