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
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/** Decorative wrapper; children keep their own event handlers and layout. */
export function LuluToolbar({
  children,
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div className={cn('lulu-toolbar-wrapper', className)} {...props}>
      {children}
      <img
        className='lulu-toolbar-peek'
        src='/lulu/lulu-peek.png'
        alt=''
        aria-hidden='true'
        draggable={false}
        width={54}
        height={43}
      />
    </div>
  )
}
