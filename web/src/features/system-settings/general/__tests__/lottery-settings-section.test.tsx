import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LotterySettingsSection } from '../lottery-settings-section'

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <LotterySettingsSection
        defaultValues={{
          enabled: true,
          startTime: 1790265600,
          endTime: 1791388800,
          thresholdMoney: 20,
          payoutRatio: 0.25,
          reserveQuota: 0,
        }}
      />
    </QueryClientProvider>
  )
}

describe('LotterySettingsSection', () => {
  it('renders the switch and every numeric field from the defaults', () => {
    renderSection()
    expect(
      screen.getByRole('switch', { name: 'Enable recharge lottery' })
    ).toBeChecked()
    expect(
      screen.getByRole('spinbutton', { name: 'Recharge amount per draw' })
    ).toHaveValue(20)
    expect(
      screen.getByRole('spinbutton', { name: 'Max payout ratio' })
    ).toHaveValue(0.25)
  })
})
