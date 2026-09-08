import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { ModelRatioForm } from '../model-ratio-form'

const i18n = createInstance()
await i18n.use(initReactI18next).init({ lng: 'en', resources: {} })
type Values = Parameters<typeof ModelRatioForm>[0]['savedValues']
const initial: Values = {
  ModelPrice: '{"target":1,"retained":2}',
  ImageGenerationPrice: '{"target":{"1K":0.1}}',
  VideoGenerationPrice: '{"target":{"720p":0.2}}',
  ModelRatio: '{}', CacheRatio: '{}', CreateCacheRatio: '{}',
  CompletionRatio: '{}', ImageRatio: '{}', AudioRatio: '{}',
  AudioCompletionRatio: '{}', BillingMode: '{}', BillingExpr: '{}',
  ExposeRatioEnabled: false,
  GroupBillingExpr: '{"private":{"target":"p * 3","retained":"p * 2"}}',
}

function Harness(props: { save: (values: Values) => Promise<boolean> }) {
  const form = useForm<Values>({ defaultValues: initial })
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return (
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <ModelRatioForm form={form} savedValues={initial} onSave={props.save}
          onReset={() => {}} isSaving={false} isResetting={false} />
      </I18nextProvider>
    </QueryClientProvider>
  )
}

afterEach(cleanup)
describe('model pricing deletion', () => {
  test('saves all pricing maps immediately and retains unrelated models', async () => {
    const save = vi.fn(async (_values: Values) => true)
    const user = userEvent.setup()
    render(<Harness save={save} />)
    const row = screen.getByText('target', { exact: true }).closest('tr')
    expect(row).not.toBeNull()
    if (!row) throw new Error('Missing target row')
    await user.click(within(row).getByRole('button', { name: 'Open menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    const values = save.mock.calls[0][0]
    expect(JSON.parse(values.ModelPrice)).toEqual({ retained: 2 })
    expect(JSON.parse(values.ImageGenerationPrice)).toEqual({})
    expect(JSON.parse(values.VideoGenerationPrice)).toEqual({})
    expect(JSON.parse(values.GroupBillingExpr)).toEqual({ private: { retained: 'p * 2' } })
    await waitFor(() => expect(screen.queryByText('target', { exact: true })).toBeNull())
    expect(screen.getByText('retained', { exact: true })).toBeTruthy()
  })

  test('keeps the model visible when the server rejects deletion', async () => {
    const save = vi.fn(async (_values: Values) => false)
    const user = userEvent.setup()
    render(<Harness save={save} />)
    const row = screen.getByText('target', { exact: true }).closest('tr')
    expect(row).not.toBeNull()
    if (!row) throw new Error('Missing target row')
    await user.click(within(row).getByRole('button', { name: 'Open menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(screen.getByText('target', { exact: true })).toBeTruthy()
  })
})
