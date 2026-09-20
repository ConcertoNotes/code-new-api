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
import i18n from 'i18next'

import { getCookie } from '@/lib/cookies'
import {
  DEFAULT_THEME_CUSTOMIZATION,
  THEME_COOKIE_KEYS,
  THEME_SKIN_VALUES,
  type ThemeSkin,
} from '@/lib/theme-customization'

import classicEn from './locales/classic/en.json'
import classicFr from './locales/classic/fr.json'
import classicJa from './locales/classic/ja.json'
import classicRu from './locales/classic/ru.json'
import classicVi from './locales/classic/vi.json'
import classicZhTW from './locales/classic/zh-TW.json'
import classicZhCN from './locales/classic/zh.json'
import en from './locales/en.json'
import fr from './locales/fr.json'
import ja from './locales/ja.json'
import ru from './locales/ru.json'
import vi from './locales/vi.json'
import zhTW from './locales/zh-TW.json'
import zhCN from './locales/zh.json'

type Wording = Record<string, string>

/**
 * 站点文案分两套：`locales/{lang}.json` 是默认的噜噜版；
 * `locales/classic/{lang}.json` 只收录被噜噜化过的键，值为上游 new-api 的原版文案。
 * 切换皮肤时只替换这部分键，其余翻译保持不变。
 */
const CLASSIC_WORDING: Record<string, Wording> = {
  en: classicEn,
  zhCN: classicZhCN,
  zhTW: classicZhTW,
  fr: classicFr,
  ru: classicRu,
  ja: classicJa,
  vi: classicVi,
}

const BASE_WORDING: Record<string, Wording> = {
  en: en.translation,
  zhCN: zhCN.translation,
  zhTW: zhTW.translation,
  fr: fr.translation,
  ru: ru.translation,
  ja: ja.translation,
  vi: vi.translation,
}

/** 与原版覆盖表同一批键的噜噜版取值，用于切回噜噜版时还原。 */
const LULU_WORDING: Record<string, Wording> = Object.fromEntries(
  Object.entries(CLASSIC_WORDING).map(([lng, classic]) => [
    lng,
    Object.fromEntries(
      Object.keys(classic).map((key) => [key, BASE_WORDING[lng][key] ?? key])
    ),
  ])
)

/** 读取持久化的皮肤选择；启动时用它先行应用文案，避免首屏闪一下噜噜文案。 */
export function readThemeSkinCookie(): ThemeSkin {
  const value = getCookie(THEME_COOKIE_KEYS.skin) as ThemeSkin | undefined
  return value && THEME_SKIN_VALUES.has(value)
    ? value
    : DEFAULT_THEME_CUSTOMIZATION.skin
}

/**
 * 把当前皮肤对应的文案写入 i18next 资源。
 * `addResourceBundle` 会触发 store 的 `added` 事件，`config.ts` 里开启了
 * `bindI18nStore: 'added'`，因此使用 `useTranslation` 的组件会自动重渲染。
 */
export function applyI18nSkin(skin: ThemeSkin) {
  const wording = skin === 'classic' ? CLASSIC_WORDING : LULU_WORDING
  for (const [lng, bundle] of Object.entries(wording)) {
    i18n.addResourceBundle(lng, 'translation', bundle, false, true)
  }
}
