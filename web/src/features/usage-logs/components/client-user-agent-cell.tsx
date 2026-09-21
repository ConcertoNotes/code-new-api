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
import { Terminal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  CLIENT_CATEGORY_LABEL_KEY,
  classifyClientUserAgent,
} from '../lib/client-info'

interface ClientUserAgentCellProps {
  userAgent: string
}

/**
 * Admin list cell for the caller's User-Agent: a classified client label
 * (tool name · category) on top, the raw header truncated underneath. The
 * full header is available through the title tooltip and the details dialog.
 */
export function ClientUserAgentCell(props: ClientUserAgentCellProps) {
  const { t } = useTranslation()
  const info = classifyClientUserAgent(props.userAgent)
  const label = info
    ? [info.name, t(CLIENT_CATEGORY_LABEL_KEY[info.category])]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <div
      data-testid='client-user-agent-cell'
      className='flex max-w-[180px] min-w-0 flex-col gap-0.5'
      title={props.userAgent}
    >
      {label && (
        <span className='flex min-w-0 items-center gap-1 text-xs'>
          <Terminal
            className='text-muted-foreground size-3 shrink-0'
            aria-hidden='true'
          />
          <span className='truncate'>{label}</span>
        </span>
      )}
      <span className='text-muted-foreground truncate font-mono text-[11px]'>
        {props.userAgent}
      </span>
    </div>
  )
}
