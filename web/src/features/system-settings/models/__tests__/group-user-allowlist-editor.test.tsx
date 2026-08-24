/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import assert from 'node:assert/strict'

import { afterEach, beforeAll, describe, test } from 'vitest'

const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { act, useState } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { api } = await import('@/lib/api')
const { GroupUserAllowlistEditor } =
  await import('../group-user-allowlist-editor')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        Add: 'Add',
        Group: 'Group',
        'No rules yet': 'No rules yet',
        'No users': 'No users',
        Remove: 'Remove',
        'Search users...': 'Search users...',
        'User-specific group access': 'User-specific group access',
      },
    },
  },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

function Harness(props: { initialValue: string }) {
  const [value, setValue] = useState(props.initialValue)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <GroupUserAllowlistEditor
          value={value}
          groupOptions={['default', 'private']}
          onChange={setValue}
        />
        <output data-testid='allowlist-value'>{value}</output>
      </I18nextProvider>
    </QueryClientProvider>
  )
}

async function flushQueries() {
  await act(async () => {
    await new Promise<void>((resolve) => setImmediate(resolve))
  })
}

function click(element: Element) {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('user-specific group access editor', () => {
  beforeAll(() => {
    api.defaults.adapter = async (config) => ({
      data: {
        success: true,
        data: [
          {
            id: 1,
            username: 'alice',
            display_name: 'Alice',
            group: 'default',
            status: 1,
          },
        ],
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    document.body.replaceChildren()
  })

  test('adds the selected user to the selected private group', async () => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root.render(<Harness initialValue='{}' />))
    await flushQueries()

    const groupTrigger = container.querySelector<HTMLButtonElement>(
      'button[role="combobox"]'
    )
    assert.ok(groupTrigger)
    await act(async () => click(groupTrigger))
    const privateOption = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="select-item"]'),
    ].find((item) => item.textContent === 'private')
    assert.ok(privateOption)
    await act(async () => {
      privateOption.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
        })
      )
      click(privateOption)
    })
    assert.match(groupTrigger.textContent ?? '', /private/)

    const userInput = container.querySelector<HTMLInputElement>(
      'input[role="combobox"]'
    )
    assert.ok(userInput)
    await act(async () => {
      userInput.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
        })
      )
      userInput.focus()
    })
    const userOption = document.querySelector<HTMLElement>('li[role="option"]')
    assert.ok(userOption)
    await act(async () => {
      userOption.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
        })
      )
    })
    assert.match(userInput.value, /Alice/)

    const addButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Add'
    )
    assert.ok(addButton)
    assert.equal(addButton.disabled, false)
    await act(async () => click(addButton))
    await flushQueries()

    const output = container.querySelector('[data-testid="allowlist-value"]')
    assert.equal(output?.textContent, '{\n  "private": [\n    1\n  ]\n}')
  })

  test('removing the last user clears the group restriction', async () => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () =>
      root.render(<Harness initialValue='{"private":[1]}' />)
    )
    await flushQueries()

    const removeButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove"]'
    )
    assert.ok(removeButton)
    await act(async () => click(removeButton))

    const output = container.querySelector('[data-testid="allowlist-value"]')
    assert.equal(output?.textContent, '{}')
  })
})
