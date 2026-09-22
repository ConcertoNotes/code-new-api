import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LotteryMonitorSection } from '../lottery-monitor-section'

const mocks = vi.hoisted(() => ({
  getLotteryAdminOverview: vi.fn(),
  getLotteryAdminDraws: vi.fn(),
}))

vi.mock('../lottery-admin-api', () => ({
  getLotteryAdminOverview: mocks.getLotteryAdminOverview,
  getLotteryAdminDraws: mocks.getLotteryAdminDraws,
}))

const overview = {
  prizes: [
    { id: 1, amount: 1, stock: 78, initial_stock: 80 },
    { id: 2, amount: 2, stock: 40, initial_stock: 40 },
    { id: 3, amount: 5, stock: 9, initial_stock: 10 },
    { id: 4, amount: 10, stock: 5, initial_stock: 5 },
  ],
  total_recharge: 60,
  budget_remaining: 1.05,
  issued_amount: 7,
  issued_quota: 3500000,
  draw_count: 3,
  winner_count: 2,
  winners: [
    {
      user_id: 7,
      username: 'alice',
      draws: 2,
      total_amount: 6,
      total_quota: 3000000,
      last_draw_at: 1790265600,
    },
    {
      user_id: 9,
      username: 'bob',
      draws: 1,
      total_amount: 1,
      total_quota: 500000,
      last_draw_at: 1790265500,
    },
  ],
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <LotteryMonitorSection />
    </QueryClientProvider>
  )
}

afterEach(() => {
  mocks.getLotteryAdminOverview.mockReset()
  mocks.getLotteryAdminDraws.mockReset()
})

describe('LotteryMonitorSection', () => {
  it('shows remaining tickets per tier and the winners leaderboard', async () => {
    mocks.getLotteryAdminOverview.mockResolvedValue(overview)
    mocks.getLotteryAdminDraws.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
    })
    renderSection()

    const stock = await screen.findByRole('table', {
      name: 'Remaining tickets',
    })
    const rows = within(stock).getAllByRole('row')
    expect(rows).toHaveLength(6) // header + 4 tiers + total
    expect(rows[1]).toHaveTextContent('1 quota')
    expect(rows[1]).toHaveTextContent('78')
    expect(rows[5]).toHaveTextContent('132') // 78+40+9+5 remaining

    const leaderboard = screen.getByRole('table', {
      name: 'Winners leaderboard',
    })
    const alice = within(leaderboard).getByText('alice').closest('tr')
    expect(alice).toHaveTextContent('6 quota')
    expect(alice).toHaveTextContent('2')
  })

  it('lists every draw with its user and requests the next page on demand', async () => {
    mocks.getLotteryAdminOverview.mockResolvedValue(overview)
    mocks.getLotteryAdminDraws.mockImplementation(
      ({ page }: { page: number }) =>
        Promise.resolve({
          items: [
            {
              id: page * 100,
              user_id: 7,
              username: 'alice',
              amount: 5,
              quota: 2500000,
              user_factor: 0.6,
              budget_factor: 1.2,
              stock_snapshot: '1:79,2:40,5:10,10:5',
              created_at: 1790265600,
            },
          ],
          total: 25,
          page,
          page_size: 20,
        })
    )
    renderSection()

    const table = await screen.findByRole('table', { name: 'All draws' })
    expect(within(table).getByText('alice')).toBeInTheDocument()
    expect(table).toHaveTextContent('5 quota')
    expect(table).toHaveTextContent('1:79,2:40,5:10,10:5')

    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() =>
      expect(mocks.getLotteryAdminDraws).toHaveBeenLastCalledWith({
        page: 2,
        pageSize: 20,
        keyword: '',
      })
    )
  })

  it('filters draws by username when searching', async () => {
    mocks.getLotteryAdminOverview.mockResolvedValue(overview)
    mocks.getLotteryAdminDraws.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
    })
    renderSection()

    await screen.findByRole('table', { name: 'Remaining tickets' })
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Search by username' }),
      'bob{Enter}'
    )

    await waitFor(() =>
      expect(mocks.getLotteryAdminDraws).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 20,
        keyword: 'bob',
      })
    )
    expect(screen.getByText('No draws yet')).toBeInTheDocument()
  })

  it('renders an empty pool without crashing when nobody has drawn yet', async () => {
    mocks.getLotteryAdminOverview.mockResolvedValue({
      ...overview,
      draw_count: 0,
      winner_count: 0,
      winners: [],
    })
    mocks.getLotteryAdminDraws.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
    })
    renderSection()

    await screen.findByRole('table', { name: 'Remaining tickets' })
    expect(screen.getAllByText('No draws yet')).toHaveLength(2)
  })

  it('shows an error when the overview request fails', async () => {
    mocks.getLotteryAdminOverview.mockRejectedValue(new Error('boom'))
    mocks.getLotteryAdminDraws.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
    })
    renderSection()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load lottery overview'
    )
  })
})
