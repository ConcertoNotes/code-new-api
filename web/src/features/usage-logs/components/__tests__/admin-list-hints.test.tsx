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
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { ClientUserAgentCell } from '../client-user-agent-cell'
import { ReasoningEffortHint } from '../reasoning-effort-hint'

describe('ClientUserAgentCell', () => {
  test('shows the classified client name and keeps the raw header in the tooltip', () => {
    render(<ClientUserAgentCell userAgent='claude-cli/1.2.3 (external, cli)' />)

    expect(screen.getByText(/Claude Code/)).toBeInTheDocument()
    expect(
      screen.getByText('claude-cli/1.2.3 (external, cli)')
    ).toBeInTheDocument()
    expect(screen.getByTestId('client-user-agent-cell')).toHaveAttribute(
      'title',
      'claude-cli/1.2.3 (external, cli)'
    )
  })

  test('falls back to the raw header alone for an unclassified user agent', () => {
    render(<ClientUserAgentCell userAgent='totally-unknown-agent/0.1' />)

    expect(screen.getByText('totally-unknown-agent/0.1')).toBeInTheDocument()
    expect(screen.queryByText(/·/)).toBeNull()
  })
})

describe('ReasoningEffortHint', () => {
  test('renders only the requested effort when upstream matches or is absent', () => {
    render(<ReasoningEffortHint effort='xhigh' upstreamEffort='XHIGH' />)

    expect(screen.getAllByText('xhigh')).toHaveLength(1)
    expect(screen.queryByText('XHIGH')).toBeNull()
  })

  test('renders the upstream effort next to the requested one when they differ', () => {
    render(<ReasoningEffortHint effort='xhigh' upstreamEffort='high' />)

    expect(screen.getByText('xhigh')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByTestId('reasoning-effort-hint')).toHaveAttribute(
      'title',
      expect.stringContaining('high')
    )
  })
})
