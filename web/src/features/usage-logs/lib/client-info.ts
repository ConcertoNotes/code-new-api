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

export type ClientCategory =
  | 'terminal'
  | 'ide'
  | 'sdk'
  | 'script'
  | 'browser'
  | 'unknown'

export interface ClientInfo {
  category: ClientCategory
  // Brand/tool name (proper noun, not translated), absent for generic
  // categories like 'browser' or 'unknown'.
  name?: string
}

// i18n key for each category's display label.
export const CLIENT_CATEGORY_LABEL_KEY: Record<ClientCategory, string> = {
  terminal: 'Terminal Tool',
  ide: 'IDE Plugin',
  sdk: 'SDK',
  script: 'API Tool',
  browser: 'Browser',
  unknown: 'Unknown',
}

// Command-line / terminal AI coding agents.
const TERMINAL_TOOL_PATTERNS: Array<[RegExp, string]> = [
  [/claude-cli/i, 'Claude Code'],
  [/codex[-_]cli/i, 'Codex CLI'],
  [/gemini-cli/i, 'Gemini CLI'],
  [/opencode/i, 'opencode'],
  [/aider/i, 'Aider'],
  [/goose/i, 'Goose'],
  [/crush/i, 'Crush'],
]

// Editor/IDE extensions that call the API on the user's behalf.
const IDE_PLUGIN_PATTERNS: Array<[RegExp, string]> = [
  [/cursor/i, 'Cursor'],
  [/cline/i, 'Cline'],
  [/continue/i, 'Continue'],
  [/windsurf/i, 'Windsurf'],
  [/roo-?code/i, 'Roo Code'],
  [/zed/i, 'Zed'],
]

// Official/well-known SDKs and agent frameworks.
const SDK_PATTERNS: Array<[RegExp, string]> = [
  [/openai\/python/i, 'OpenAI Python SDK'],
  [/openai\/node/i, 'OpenAI Node SDK'],
  [/anthropic\/python/i, 'Anthropic Python SDK'],
  [/anthropic\/node|claude-typescript/i, 'Anthropic Node SDK'],
  [/langchain/i, 'LangChain'],
  [/litellm/i, 'LiteLLM'],
]

// Generic HTTP clients and API-testing tools.
const SCRIPT_PATTERNS: Array<[RegExp, string]> = [
  [/curl\//i, 'curl'],
  [/postmanruntime/i, 'Postman'],
  [/insomnia/i, 'Insomnia'],
  [/python-requests|httpx|aiohttp/i, 'Python HTTP Client'],
  [/node-fetch|axios|undici/i, 'Node.js HTTP Client'],
  [/go-http-client/i, 'Go HTTP Client'],
]

const BROWSER_PATTERN = /^mozilla\//i

/**
 * Classify a raw User-Agent header into a coarse client category (terminal
 * tool, IDE plugin, SDK, script/API tool, browser) plus a recognized brand
 * name when one matches. Returns null when there is no User-Agent to
 * classify; returns { category: 'unknown' } when the User-Agent doesn't
 * match any known pattern (still meaningful — it's not a recognized tool).
 */
export function classifyClientUserAgent(
  userAgent: string | undefined | null
): ClientInfo | null {
  const ua = userAgent?.trim()
  if (!ua) return null

  for (const [pattern, name] of TERMINAL_TOOL_PATTERNS) {
    if (pattern.test(ua)) return { category: 'terminal', name }
  }
  for (const [pattern, name] of IDE_PLUGIN_PATTERNS) {
    if (pattern.test(ua)) return { category: 'ide', name }
  }
  for (const [pattern, name] of SDK_PATTERNS) {
    if (pattern.test(ua)) return { category: 'sdk', name }
  }
  for (const [pattern, name] of SCRIPT_PATTERNS) {
    if (pattern.test(ua)) return { category: 'script', name }
  }
  if (BROWSER_PATTERN.test(ua)) return { category: 'browser' }
  return { category: 'unknown' }
}
