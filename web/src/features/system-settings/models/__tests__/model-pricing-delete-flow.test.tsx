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

import { afterEach, describe, test } from 'vitest'

const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { act, useState } = await import('react')
const { createRoot } = await import('react-dom/client')
const { useForm } = await import('react-hook-form')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { ModelRatioForm } = await import('../model-ratio-form')

const i18n = createInstance()
await i18n.use(initReactI18next).init({ lng: 'en', resources: {} })

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

type ModelFormValues = Parameters<typeof ModelRatioForm>[0]['savedValues']

const initialValues: ModelFormValues = {
  ModelPrice: JSON.stringify({ target: 1, retained: 2 }),
  ImageGenerationPrice: JSON.stringify({ target: { '1K': 0.1 } }),
  VideoGenerationPrice: '{}',
  ModelRatio: '{}',
  CacheRatio: '{}',
  CreateCacheRatio: '{}',
  CompletionRatio: '{}',
  ImageRatio: '{}',
  AudioRatio: '{}',
  AudioCompletionRatio: '{}',
  ExposeRatioEnabled: false,
  BillingMode: '{}',
  BillingExpr: '{}',
  GroupBillingExpr: '{}',
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
const savedValues: ModelFormValues[] = []

function Harness(props: { saveResult?: boolean }) {
  const form = useForm<ModelFormValues>({ defaultValues: initialValues })
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ModelRatioForm
          form={form}
          savedValues={initialValues}
          onSave={async (values) => {
            savedValues.push(values)
            return props.saveResult ?? true
          }}
          onReset={() => {}}
          isSaving={false}
          isResetting={false}
        />
      </I18nextProvider>
    </QueryClientProvider>
  )
}

function click(element: Element) {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

async function flush() {
  await act(async () => {
    await new Promise<void>((resolve) => setImmediate(resolve))
  })
}

async function deleteModel(modelName: string) {
  const targetRow = [...container.querySelectorAll('tr')].find((row) =>
    row.textContent?.includes(modelName)
  )
  assert.ok(targetRow)
  const menuButton = targetRow.querySelector<HTMLButtonElement>(
    'button[aria-label="Open menu"]'
  )
  assert.ok(menuButton)
  await act(async () => click(menuButton))
  await flush()

  const deleteItem = document.querySelector<HTMLElement>(
    '[data-slot="dropdown-menu-item"]'
  )
  assert.ok(deleteItem)
  await act(async () => click(deleteItem))
  await flush()
}

describe('model pricing delete flow', () => {
  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    document.body.replaceChildren()
    savedValues.length = 0
  })

  test('clicking delete saves the removal immediately and removes the row', async () => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root.render(<Harness />))

    await deleteModel('target')

    assert.equal(savedValues.length, 1)
    assert.deepEqual(JSON.parse(savedValues[0].ModelPrice), { retained: 2 })
    assert.deepEqual(JSON.parse(savedValues[0].ImageGenerationPrice), {})
    assert.doesNotMatch(container.textContent ?? '', /target/)
    assert.match(container.textContent ?? '', /retained/)
  })

  test('keeps the model visible when saving the deletion fails', async () => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root.render(<Harness saveResult={false} />))

    await deleteModel('target')

    assert.equal(savedValues.length, 1)
    assert.match(container.textContent ?? '', /target/)
  })
})
