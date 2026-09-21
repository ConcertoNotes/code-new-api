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
import { CornerDownRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'

import { getReasoningEffortVariant } from '../lib/format'

interface ReasoningEffortHintProps {
  effort: string
  // Effort actually forwarded upstream when a suffix/mapping rewrote it.
  upstreamEffort?: string
}

/**
 * Admin list hint under the model badge: the requested reasoning effort, and
 * the effort actually sent upstream when the two differ.
 */
export function ReasoningEffortHint(props: ReasoningEffortHintProps) {
  const { t } = useTranslation()
  const upstream = props.upstreamEffort?.trim()
  const showUpstream =
    !!upstream && upstream.toLowerCase() !== props.effort.trim().toLowerCase()

  return (
    <span
      data-testid='reasoning-effort-hint'
      className='flex min-w-0 items-center gap-1'
      title={
        showUpstream
          ? `${t('Reasoning Effort')}: ${props.effort}\n${t('Upstream Reasoning Effort')}: ${upstream}`
          : `${t('Reasoning Effort')}: ${props.effort}`
      }
    >
      <StatusBadge
        label={props.effort}
        variant={getReasoningEffortVariant(props.effort)}
        size='sm'
        copyable={false}
        className='shrink-0'
      />
      {showUpstream && (
        <>
          <CornerDownRight
            className='text-muted-foreground size-3 shrink-0'
            aria-hidden='true'
          />
          <StatusBadge
            label={upstream}
            variant={getReasoningEffortVariant(upstream)}
            size='sm'
            copyable={false}
            className='shrink-0'
          />
        </>
      )}
    </span>
  )
}
