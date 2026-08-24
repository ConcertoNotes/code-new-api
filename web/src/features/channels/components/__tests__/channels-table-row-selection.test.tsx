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
import type { Row } from '@tanstack/react-table'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { Channel } from '../../types'
import { ChannelsTable } from '../channels-table'

const apiMocks = vi.hoisted(() => ({
  getChannels: vi.fn(),
  getGroups: vi.fn(),
  searchChannels: vi.fn(),
}))

const urlStateMocks = vi.hoisted(() => ({
  onGlobalFilterChange: vi.fn(),
  onColumnFiltersChange: vi.fn(),
  onPaginationChange: vi.fn(),
  ensurePageInRange: vi.fn(),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    getRouteApi: () => ({
      useSearch: () => ({}),
      useNavigate: () => vi.fn(),
    }),
  }
})

vi.mock('@/hooks', () => ({
  useDebounce: <T,>(value: T) => value,
  useMediaQuery: () => false,
}))

vi.mock('@/hooks/use-table-url-state', () => ({
  useTableUrlState: () => ({
    globalFilter: '',
    onGlobalFilterChange: urlStateMocks.onGlobalFilterChange,
    columnFilters: [],
    onColumnFiltersChange: urlStateMocks.onColumnFiltersChange,
    pagination: { pageIndex: 0, pageSize: 20 },
    onPaginationChange: urlStateMocks.onPaginationChange,
    ensurePageInRange: urlStateMocks.ensurePageInRange,
  }),
}))

vi.mock('@/lib/lobe-icon', () => ({
  getLobeIcon: () => null,
}))

vi.mock('../../api', () => apiMocks)

vi.mock('../channels-provider', () => ({
  useChannels: () => ({
    enableTagMode: false,
    idSort: false,
    batchMode: true,
    sensitiveVisible: true,
    setSensitiveVisible: vi.fn(),
  }),
}))

vi.mock('../channels-columns', async () => {
  const React = await import('react')
  return {
    useChannelsColumns: () => [
      {
        id: 'select',
        cell: ({ row }: { row: Row<Channel> }) =>
          React.createElement('input', {
            type: 'checkbox',
            checked: row.getIsSelected(),
            onChange: () => row.toggleSelected(),
            'aria-label': `Select ${row.original.name}`,
          }),
      },
      {
        accessorKey: 'name',
        header: 'Name',
      },
      { accessorKey: 'status', header: 'Status' },
      { accessorKey: 'type', header: 'Type' },
      { accessorKey: 'group', header: 'Group' },
    ],
  }
})

vi.mock('../data-table-bulk-actions', () => ({
  DataTableBulkActions: () => null,
}))

function channel(id: number, name: string): Channel {
  return {
    id,
    name,
    status: 1,
    type: 1,
    group: 'default',
  } as Channel
}

function channelResponse(items: Channel[]) {
  return {
    data: {
      items,
      total: items.length,
      type_counts: {},
    },
  }
}

function renderWithQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  render(
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return queryClient
}

describe('ChannelsTable row selection', () => {
  beforeEach(() => {
    localStorage.clear()
    apiMocks.getChannels.mockReset()
    apiMocks.searchChannels.mockReset()
    apiMocks.getGroups.mockReset()
    apiMocks.getGroups.mockResolvedValue({ data: [] })
  })

  test('keeps selection on the same channel after server-side reordering', async () => {
    const firstPage = [channel(101, 'Alpha'), channel(202, 'Beta')]
    const reorderedPage = [channel(202, 'Beta'), channel(101, 'Alpha')]
    apiMocks.getChannels
      .mockResolvedValueOnce(channelResponse(firstPage))
      .mockResolvedValueOnce(channelResponse(reorderedPage))
    const user = userEvent.setup()
    const queryClient = renderWithQueryClient(<ChannelsTable />)

    const betaCheckbox = await screen.findByRole('checkbox', {
      name: 'Select Beta',
    })
    await user.click(betaCheckbox)
    expect(betaCheckbox).toBeChecked()

    await act(async () => {
      await queryClient.invalidateQueries()
    })

    await waitFor(() => {
      expect(apiMocks.getChannels).toHaveBeenCalledTimes(2)
      const rowCheckboxes = screen
        .getAllByRole('checkbox')
        .filter((checkbox) =>
          checkbox.getAttribute('aria-label')?.startsWith('Select ')
        )
      expect(
        rowCheckboxes.map((checkbox) => checkbox.getAttribute('aria-label'))
      ).toEqual(['Select Beta', 'Select Alpha'])
    })
    expect(screen.getByRole('checkbox', { name: 'Select Beta' })).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: 'Select Alpha' })
    ).not.toBeChecked()
  })
})
