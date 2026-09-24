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
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'

import { DataTablePagination } from '../pagination'

const rows = [{ id: 1 }, { id: 2 }, { id: 3 }]
const emptyRows: { id: number }[] = []

function Fixture(props: { empty?: boolean; compact?: boolean }) {
  const table = useReactTable({
    data: props.empty ? emptyRows : rows,
    columns: [{ accessorKey: 'id' }],
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
  })
  return <DataTablePagination table={table} compact={props.compact} />
}
it('moves between pages in compact mode and disables the boundary actions', async () => {
  const user = userEvent.setup()
  render(<Fixture compact />)
  expect(screen.getByText('1 / 2')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Go to previous page' })
  ).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Go to next page' }))
  expect(screen.getByText('2 / 2')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Go to next page' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Go to previous page' }))
  expect(screen.getByText('1 / 2')).toBeVisible()
})
it('shows a valid empty page with navigation disabled', () => {
  render(<Fixture empty compact />)
  expect(screen.getByText('1 / 1')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Go to previous page' })
  ).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Go to next page' })).toBeDisabled()
})
it('keeps page size selection available in the default layout', () => {
  render(<Fixture />)
  expect(screen.getByRole('combobox')).toBeVisible()
})

const manyRows = Array.from({ length: 100 }, (_, id) => ({ id }))

function PaginatedRecords() {
  const table = useReactTable({
    data: manyRows,
    columns: [{ accessorKey: 'id' }],
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 4, pageSize: 10 } },
  })
  return (
    <>
      <output aria-label='Current page'>
        {table.getState().pagination.pageIndex + 1}
      </output>
      <DataTablePagination table={table} />
    </>
  )
}

it('decorated pagination retains keyboard navigation and disables boundary actions', async () => {
  const user = userEvent.setup()
  render(<PaginatedRecords />)
  screen.getByRole('button', { name: 'Go to first page' }).focus()
  await user.keyboard('{Enter}')
  expect(screen.getByLabelText('Current page')).toHaveTextContent('1')
  expect(
    screen.getByRole('button', { name: 'Go to previous page' })
  ).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Go to last page' }))
  expect(screen.getByLabelText('Current page')).toHaveTextContent('10')
  expect(screen.getByRole('button', { name: 'Go to next page' })).toBeDisabled()
})
