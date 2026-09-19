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
import { CopyButton } from '@/components/copy-button'

export function CodeSample(props: { code: string; label: string }) {
  return (
    <div className='border-border overflow-hidden rounded-md border bg-zinc-950 text-zinc-100'>
      <div className='flex h-10 items-center justify-between border-b border-zinc-800 px-3'>
        <span className='text-xs font-medium text-zinc-400'>{props.label}</span>
        <CopyButton
          value={props.code}
          className='size-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
          iconClassName='size-4'
          tooltip='Copy code'
          successTooltip='Copied!'
        />
      </div>
      <pre className='max-h-[32rem] overflow-auto p-4 font-mono text-xs leading-6 sm:text-sm'>
        <code>{props.code}</code>
      </pre>
    </div>
  )
}
