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
import { cn } from '@/lib/utils'

import {
  UPSTREAM_MODEL_AUDIT_LABEL_KEY,
  type UpstreamModelAudit,
} from '../lib/model-audit'

interface UpstreamModelHintProps {
  audit: UpstreamModelAudit | null
  className?: string
}

/**
 * Admin-only inline hint under the model badge: shows the model the upstream
 * actually served when it differs from the one we sent. Matching and
 * undeclared responses render nothing so the list stays quiet by default.
 */
export function UpstreamModelHint(props: UpstreamModelHintProps) {
  const { t } = useTranslation()
  const audit = props.audit
  if (!audit || audit.status === 'match' || audit.status === 'unknown') {
    return null
  }
  const isVariant = audit.status === 'variant'
  return (
    <span
      data-testid='upstream-model-hint'
      className={cn(
        'flex min-w-0 items-center gap-1 text-[11px]',
        isVariant
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-red-600 dark:text-red-400',
        props.className
      )}
      title={`${t('Sent Upstream')}: ${audit.sentModel}\n${t('Upstream Response')}: ${audit.responseModel}`}
    >
      <CornerDownRight className='size-3 shrink-0' aria-hidden='true' />
      <span className='truncate font-mono'>{audit.responseModel}</span>
      <StatusBadge
        label={t(UPSTREAM_MODEL_AUDIT_LABEL_KEY[audit.status])}
        variant={isVariant ? 'warning' : 'danger'}
        size='sm'
        copyable={false}
        className='shrink-0'
      />
    </span>
  )
}
