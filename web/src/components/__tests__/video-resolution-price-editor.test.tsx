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
import assert from 'node:assert/strict'
import { after, afterEach, describe, test } from 'node:test'

import { Window } from 'happy-dom'

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLButtonElement',
  'HTMLInputElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'FocusEvent',
  'MouseEvent',
  'PointerEvent',
  'CustomEvent',
  'MutationObserver',
  'ResizeObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const { act, useState } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { VideoResolutionPriceEditor } =
  await import('../video-resolution-price-editor')
const { createVideoResolutionPriceRows, videoResolutionPriceRowsToRecord } =
  await import('../video-resolution-pricing')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'Add resolution': 'Add resolution',
        Delete: 'Delete',
        Resolution: 'Resolution',
        'USD per generated video second': 'USD per generated video second',
        'Video resolution pricing': 'Video resolution pricing',
        'Set the USD price for one generated second at each resolution.':
          'Set the USD price for one generated second at each resolution.',
        'per second': 'per second',
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

function Harness() {
  const [rows, setRows] = useState(() => createVideoResolutionPriceRows())
  return (
    <I18nextProvider i18n={i18n}>
      <VideoResolutionPriceEditor rows={rows} onChange={setRows} />
      <output data-testid='prices'>
        {JSON.stringify(videoResolutionPriceRowsToRecord(rows))}
      </output>
    </I18nextProvider>
  )
}

function click(element: Element) {
  element.dispatchEvent(
    new domWindow.MouseEvent('click', { bubbles: true }) as unknown as Event
  )
}

function enterValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    domWindow.HTMLInputElement.prototype,
    'value'
  )?.set
  assert.ok(valueSetter)
  valueSetter.call(input, value)
  input.dispatchEvent(
    new domWindow.Event('input', { bubbles: true }) as unknown as Event
  )
}

describe('video resolution price editor', () => {
  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    document.body.replaceChildren()
  })

  after(() => domWindow.close())

  test('adds, edits, and removes a custom resolution row', async () => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root.render(<Harness />))

    const addButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Add resolution'
    )
    assert.ok(addButton)
    await act(async () => click(addButton))

    const resolutionInputs = container.querySelectorAll<HTMLInputElement>(
      'input[placeholder="4K"]'
    )
    const priceInputs = container.querySelectorAll<HTMLInputElement>(
      'input[inputmode="decimal"]'
    )
    assert.equal(resolutionInputs.length, 4)
    assert.equal(priceInputs.length, 4)

    await act(async () => {
      enterValue(resolutionInputs[3], '768p')
      enterValue(priceInputs[3], '0.5')
    })
    assert.equal(
      container.querySelector('[data-testid="prices"]')?.textContent,
      '{"768p":"0.5"}'
    )

    const deleteButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete"]'
    )
    assert.ok(deleteButton)
    await act(async () => click(deleteButton))
    assert.equal(
      container.querySelector('[data-testid="prices"]')?.textContent,
      '{}'
    )
  })
})
