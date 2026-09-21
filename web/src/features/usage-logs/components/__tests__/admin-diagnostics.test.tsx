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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'

import type { UsageLog } from '../../data/schema'
import type { LogOtherData } from '../../types'
import { DetailsDialog } from '../dialogs/details-dialog'
import { UpstreamModelHint } from '../upstream-model-hint'

const queryClients: QueryClient[] = []

function makeLog(type: number, other: LogOtherData): UsageLog {
  return {
    id: 1,
    user_id: 1,
    created_at: 1,
    type,
    content: 'content',
    username: 'user',
    token_name: 'token',
    model_name: 'gpt-4o',
    quota: 10,
    prompt_tokens: 12,
    completion_tokens: 3,
    use_time: 1,
    is_stream: false,
    channel: 7,
    channel_name: 'channel',
    token_id: 1,
    group: 'default',
    ip: '',
    other: JSON.stringify(other),
    request_id: 'req-1',
    upstream_request_id: '',
  }
}

const adminOther: LogOtherData = {
  model_ratio: 1,
  completion_ratio: 1,
  group_ratio: 1,
  admin_info: {
    sent_model: 'gpt-4o',
    upstream_response_model: 'gpt-4o-mini',
    upstream_model_mismatch: true,
    model_mapping_chain: 'gpt-4o-alias → gpt-4o',
    retry_index: 1,
    channel_type: 1,
    channel_base_url: 'https://upstream.example.com',
    estimated_prompt_tokens: 40,
    pre_consumed_quota: 5000,
    header_override_keys: ['X-Custom'],
    upstream_usage: {
      prompt_tokens: 12,
      completion_tokens: 3,
      total_tokens: 15,
    },
    upstream: {
      endpoint: 'https://upstream.example.com/v1/chat/completions',
      method: 'POST',
      status_code: 200,
      proto: 'HTTP/2.0',
      ttfb_ms: 250,
      duration_ms: 1500,
      response_bytes: 2048,
      finish_reason: 'stop',
      ratelimit: { 'x-ratelimit-remaining-requests': '99' },
    },
  },
}

function renderDetails(log: UsageLog, isAdmin: boolean): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(['status'], {}, { updatedAt: Date.now() + 60_000 })
  queryClients.push(queryClient)

  render(
    <QueryClientProvider client={queryClient}>
      <DetailsDialog
        log={log}
        isAdmin={isAdmin}
        isRoot={false}
        open
        onOpenChange={() => undefined}
      />
    </QueryClientProvider>
  )
}

afterEach(() => {
  for (const queryClient of queryClients) {
    queryClient.clear()
  }
  queryClients.length = 0
})

describe('admin relay diagnostics in the log details dialog', () => {
  test('renders model audit, upstream exchange and routing sections for admins on consume logs', () => {
    renderDetails(makeLog(2, adminOther), true)

    expect(screen.getByText('Model Audit')).toBeInTheDocument()
    expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument()
    expect(screen.getByText('Model Mismatch')).toBeInTheDocument()
    expect(screen.getByText('gpt-4o-alias → gpt-4o')).toBeInTheDocument()

    expect(screen.getByText('Upstream Exchange')).toBeInTheDocument()
    expect(
      screen.getByText('https://upstream.example.com/v1/chat/completions')
    ).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
    expect(screen.getByText('stop')).toBeInTheDocument()
    expect(
      screen.getByText(/x-ratelimit-remaining-requests/)
    ).toBeInTheDocument()

    expect(screen.getByText('Routing Diagnostics')).toBeInTheDocument()
    expect(screen.getByText('Retry #1')).toBeInTheDocument()
    expect(screen.getByText('X-Custom')).toBeInTheDocument()
  })

  test('renders the sections on error logs for admins', () => {
    renderDetails(makeLog(5, adminOther), true)

    expect(screen.getByText('Upstream Exchange')).toBeInTheDocument()
    expect(screen.getByText('Model Audit')).toBeInTheDocument()
  })

  test('hides every admin diagnostic from non-admin viewers even when admin_info is present', () => {
    renderDetails(makeLog(2, adminOther), false)

    expect(screen.queryByText('Model Audit')).toBeNull()
    expect(screen.queryByText('Upstream Exchange')).toBeNull()
    expect(screen.queryByText('Routing Diagnostics')).toBeNull()
    expect(screen.queryByText('gpt-4o-mini')).toBeNull()
    expect(
      screen.queryByText('https://upstream.example.com/v1/chat/completions')
    ).toBeNull()
  })

  test('shows "Not declared" when the upstream response carried no model', () => {
    renderDetails(
      makeLog(2, {
        admin_info: {
          sent_model: 'gpt-4o',
          upstream: { status_code: 200, method: 'POST' },
        },
      }),
      true
    )

    expect(screen.getByText('Not declared')).toBeInTheDocument()
    expect(screen.queryByText('Model Mismatch')).toBeNull()
  })

  test('does not render relay diagnostics on top-up logs', () => {
    renderDetails(makeLog(1, adminOther), true)

    expect(screen.queryByText('Model Audit')).toBeNull()
    expect(screen.queryByText('Routing Diagnostics')).toBeNull()
  })
})

describe('UpstreamModelHint', () => {
  test('renders nothing for a matching or undeclared upstream model', () => {
    const { container } = render(
      <>
        <UpstreamModelHint
          audit={{
            status: 'match',
            requestedModel: 'gpt-4o',
            sentModel: 'gpt-4o',
            responseModel: 'gpt-4o',
          }}
        />
        <UpstreamModelHint audit={null} />
      </>
    )

    expect(container).toBeEmptyDOMElement()
  })

  test('shows the served model with a variant badge when only the snapshot suffix differs', () => {
    render(
      <UpstreamModelHint
        audit={{
          status: 'variant',
          requestedModel: 'gpt-4o',
          sentModel: 'gpt-4o',
          responseModel: 'gpt-4o-2024-08-06',
        }}
      />
    )

    expect(screen.getByText('gpt-4o-2024-08-06')).toBeInTheDocument()
    expect(screen.getByText('Model Variant')).toBeInTheDocument()
    expect(screen.getByTestId('upstream-model-hint')).toHaveAttribute(
      'title',
      expect.stringContaining('gpt-4o-2024-08-06')
    )
  })
})
