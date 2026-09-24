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
export type SwitchImportScheme = 'ccswitch' | 'varswitch'
export type SwitchImportTarget = 'cc-switch' | 'var-switch'
export type SwitchImportApp = 'claude' | 'codex' | 'gemini' | 'grok'

export const SWITCH_IMPORT_APPS_BY_TARGET = {
  'cc-switch': ['claude', 'codex', 'gemini'],
  'var-switch': ['claude', 'codex', 'gemini', 'grok'],
} as const satisfies Record<SwitchImportTarget, readonly SwitchImportApp[]>

type SwitchImportUrlOptions = {
  scheme: SwitchImportScheme
  app: SwitchImportApp
  name: string
  models: Record<string, string>
  apiKey: string
  serverAddress: string
}

export function buildSwitchImportUrl(options: SwitchImportUrlOptions): string {
  const endpoint =
    options.app === 'codex'
      ? `${options.serverAddress}/v1`
      : options.serverAddress
  const params = new URLSearchParams()
  params.set('resource', 'provider')
  params.set('app', options.app)
  params.set('name', options.name)
  params.set('endpoint', endpoint)
  params.set('apiKey', options.apiKey)
  for (const [key, value] of Object.entries(options.models)) {
    if (value) params.set(key, value)
  }
  params.set('homepage', options.serverAddress)
  params.set('enabled', 'true')

  return `${options.scheme}://v1/import?${params.toString()}`
}
