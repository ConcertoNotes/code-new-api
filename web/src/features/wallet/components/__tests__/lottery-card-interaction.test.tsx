import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { LotteryStatus } from '../../lottery-api'
import { LotteryCard } from '../lottery-card'

const mocks = vi.hoisted(() => ({
  drawLottery: vi.fn(),
  getLotteryRecords: vi.fn(),
}))

vi.mock('../../lottery-api', () => ({
  drawLottery: mocks.drawLottery,
  getLotteryRecords: mocks.getLotteryRecords,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const baseStatus: LotteryStatus = {
  enabled: true,
  before_start: false,
  ended: false,
  activity_start: '2026-09-25T00:00:00+08:00',
  activity_end: '2026-10-08T00:00:00+08:00',
  threshold: 20,
  draw_count: 2,
  total_recharge: 40,
  total_reward: 0,
  next_threshold: 20,
  refilling: false,
}

afterEach(() => {
  mocks.drawLottery.mockReset()
  mocks.getLotteryRecords.mockReset()
})

describe('LotteryCard', () => {
  it('renders nothing when the event is disabled or ended', () => {
    mocks.getLotteryRecords.mockResolvedValue([])
    const { container } = render(
      <LotteryCard status={{ ...baseStatus, enabled: false }} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('disables the draw button and explains when the pool is refilling', async () => {
    mocks.getLotteryRecords.mockResolvedValue([])
    render(<LotteryCard status={{ ...baseStatus, refilling: true }} />)
    expect(screen.getByRole('button', { name: 'Refilling' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(/refilling/i)
    await waitFor(() => expect(mocks.getLotteryRecords).toHaveBeenCalled())
  })

  it('disables the draw button when no draws remain', () => {
    mocks.getLotteryRecords.mockResolvedValue([])
    render(<LotteryCard status={{ ...baseStatus, draw_count: 0 }} />)
    expect(screen.getByRole('button', { name: 'Draw now' })).toBeDisabled()
  })

  it('shows the reward, reloads records and notifies the parent after a draw', async () => {
    mocks.getLotteryRecords
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 7, reward: 0.5, quota: 250000, created_at: 1790265600 },
      ])
    mocks.drawLottery.mockResolvedValue({
      reward: 0.5,
      quota: 250000,
      record_id: 7,
    })
    const onDrawn = vi.fn()
    render(<LotteryCard status={baseStatus} onDrawn={onDrawn} />)

    await userEvent.click(screen.getByRole('button', { name: 'Draw now' }))

    await waitFor(() => expect(onDrawn).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('status')).toHaveTextContent('0.5')
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'My recent draws' })
      ).toBeInTheDocument()
    )
    expect(mocks.getLotteryRecords).toHaveBeenCalledTimes(2)
  })

  it('still refreshes the parent when the server rejects the draw', async () => {
    mocks.getLotteryRecords.mockResolvedValue([])
    mocks.drawLottery.mockRejectedValue(new Error('conflict'))
    const onDrawn = vi.fn()
    render(<LotteryCard status={baseStatus} onDrawn={onDrawn} />)

    await userEvent.click(screen.getByRole('button', { name: 'Draw now' }))

    await waitFor(() => expect(onDrawn).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/popped out a pomelo/)).not.toBeInTheDocument()
  })

  it('never renders prize tiers or remaining stock', () => {
    mocks.getLotteryRecords.mockResolvedValue([])
    render(
      <LotteryCard
        status={{
          ...baseStatus,
          pool_remaining: { '1': 80, '10': 5 },
          pool_initial: { '1': 80, '10': 5 },
        }}
      />
    )
    expect(
      screen.queryByRole('list', { name: 'Prize pool' })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/80 \/ 80/)).not.toBeInTheDocument()
  })

  it('lets an admin with no draws run a preview and marks the result as not credited', async () => {
    mocks.getLotteryRecords.mockResolvedValue([])
    mocks.drawLottery.mockResolvedValue({
      reward: 10,
      quota: 5000000,
      record_id: 0,
      preview: true,
    })
    render(
      <LotteryCard
        status={{
          ...baseStatus,
          draw_count: 0,
          refilling: true,
          preview_available: true,
        }}
      />
    )
    const button = screen.getByRole('button', { name: 'Preview draw' })
    expect(button).toBeEnabled()

    await userEvent.click(button)

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('10')
    )
    expect(screen.getByRole('status')).toHaveTextContent(/no quota credited/i)
  })
})
