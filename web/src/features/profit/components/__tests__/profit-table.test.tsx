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
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import type { ChannelProfitRow } from '../../types'
import { ProfitTable } from '../profit-table'

function makeRow(overrides: Partial<ChannelProfitRow>): ChannelProfitRow {
  const channelId = overrides.channel_id ?? 1
  const group = overrides.group ?? 'default'
  return {
    key: `${channelId}|${group}`,
    channel_id: channelId,
    channel_name: `Channel ${channelId}`,
    channel_type: 1,
    channel_status: 1,
    channel_exists: true,
    hidden: false,
    group,
    sell_ratio: 1,
    upstream_ratio: 1,
    requests: 1,
    quota: 100,
    official_quota: 100,
    cost_quota: 100,
    profit_quota: 0,
    last_used_at: 0,
    ...overrides,
  }
}

function renderTable(rows: ChannelProfitRow[]) {
  const onReorder = vi.fn()
  const onHide = vi.fn()
  const onRestore = vi.fn()
  render(
    <ProfitTable
      rows={rows}
      onUpstreamRatioChange={vi.fn().mockResolvedValue(undefined)}
      onReorder={onReorder}
      onHide={onHide}
      onRestore={onRestore}
    />
  )
  return { onReorder, onHide, onRestore }
}

function makeDataTransfer() {
  const store = new Map<string, string>()
  return {
    effectAllowed: 'all',
    dropEffect: 'none',
    setData: (type: string, value: string) => store.set(type, value),
    getData: (type: string) => store.get(type) ?? '',
  }
}

describe('ProfitTable', () => {
  test('dropping a dragged handle on another row reports the source and target keys', () => {
    const { onReorder } = renderTable([
      makeRow({ channel_id: 1 }),
      makeRow({ channel_id: 2 }),
    ])
    const dataTransfer = makeDataTransfer()
    const handle = screen.getByRole('button', {
      name: 'Drag to reorder Channel 1',
    })
    const targetRow = screen
      .getByRole('button', { name: 'Drag to reorder Channel 2' })
      .closest('tr')
    expect(targetRow).not.toBeNull()

    fireEvent.dragStart(handle, { dataTransfer })
    fireEvent.dragOver(targetRow as HTMLElement, { dataTransfer })
    fireEvent.drop(targetRow as HTMLElement, { dataTransfer })

    expect(onReorder).toHaveBeenCalledWith('1|default', '2|default')
  })

  test('dropping a row onto itself does not reorder', () => {
    const { onReorder } = renderTable([makeRow({ channel_id: 1 })])
    const dataTransfer = makeDataTransfer()
    const handle = screen.getByRole('button', {
      name: 'Drag to reorder Channel 1',
    })
    const row = handle.closest('tr') as HTMLElement

    fireEvent.dragStart(handle, { dataTransfer })
    fireEvent.drop(row, { dataTransfer })

    expect(onReorder).not.toHaveBeenCalled()
  })

  test('visible rows offer remove, hidden rows offer restore', async () => {
    const user = userEvent.setup()
    const { onHide, onRestore } = renderTable([
      makeRow({ channel_id: 1 }),
      makeRow({ channel_id: 2, hidden: true }),
    ])

    await user.click(
      screen.getByRole('button', { name: 'Remove Channel 1 from the ledger' })
    )
    expect(onHide).toHaveBeenCalledWith(
      expect.objectContaining({ key: '1|default' })
    )
    expect(
      screen.queryByRole('button', { name: 'Remove Channel 2 from the ledger' })
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Restore Channel 2 to the ledger' })
    )
    expect(onRestore).toHaveBeenCalledWith(
      expect.objectContaining({ key: '2|default' })
    )
  })
})
