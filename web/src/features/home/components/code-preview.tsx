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
import { Copy01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { copyToClipboard } from '@/lib/copy-to-clipboard'

const PYTHON_EXAMPLE = `from openai import OpenAI

client = OpenAI(
    base_url="https://your-domain.com/v1",
    api_key="sk-your-api-key",
)

response = client.chat.completions.create(
    model="your-model",
    messages=[
        {"role": "user", "content": "Hello!"}
    ],
)

print(response.choices[0].message.content)`

export function CodePreview() {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const didCopy = await copyToClipboard(PYTHON_EXAMPLE)
    if (!didCopy) return

    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className='home-code-window w-full overflow-hidden rounded-lg border border-white/10 bg-[#07080d]/90 shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl'>
      <div className='flex h-10 items-center border-b border-white/8 px-4'>
        <div className='flex items-center gap-1.5' aria-hidden='true'>
          <span className='size-2 rounded-full bg-[#ff5f57]' />
          <span className='size-2 rounded-full bg-[#febc2e]' />
          <span className='size-2 rounded-full bg-[#28c840]' />
        </div>
        <span className='mx-auto font-mono text-[11px] text-white/45'>
          quickstart.py
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type='button'
                onClick={handleCopy}
                className='flex size-7 items-center justify-center rounded-md text-white/45 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400'
                aria-label={copied ? t('Copied') : t('Copy')}
              />
            }
          >
            <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} size={15} />
          </TooltipTrigger>
          <TooltipContent>{copied ? t('Copied') : t('Copy')}</TooltipContent>
        </Tooltip>
      </div>

      <div className='overflow-x-auto p-4'>
        <pre className='min-w-[31rem] font-mono text-[11px] leading-5 sm:text-xs'>
          <code>
            <span className='text-[#c792ea]'>from</span>{' '}
            <span className='text-[#82aaff]'>openai</span>{' '}
            <span className='text-[#c792ea]'>import</span>{' '}
            <span className='text-[#ffcb6b]'>OpenAI</span>
            {'\n\n'}
            <span className='text-[#f8f8f2]'>client</span>{' '}
            <span className='text-[#89ddff]'>=</span>{' '}
            <span className='text-[#ffcb6b]'>OpenAI</span>
            <span className='text-white/75'>(</span>
            {'\n    '}
            <span className='text-[#f78c6c]'>base_url</span>
            <span className='text-white/65'>=</span>
            <span className='text-[#c3e88d]'>"https://your-domain.com/v1"</span>
            <span className='text-white/65'>,</span>
            {'\n    '}
            <span className='text-[#f78c6c]'>api_key</span>
            <span className='text-white/65'>=</span>
            <span className='text-[#c3e88d]'>"sk-your-api-key"</span>
            <span className='text-white/65'>,</span>
            {'\n'}
            <span className='text-white/75'>)</span>
            {'\n\n'}
            <span className='text-[#f8f8f2]'>response</span>{' '}
            <span className='text-[#89ddff]'>=</span>{' '}
            <span className='text-[#82aaff]'>
              client.chat.completions.create
            </span>
            <span className='text-white/75'>(</span>
            {'\n    '}
            <span className='text-[#f78c6c]'>model</span>
            <span className='text-white/65'>=</span>
            <span className='text-[#c3e88d]'>"your-model"</span>
            <span className='text-white/65'>,</span>
            {'\n    '}
            <span className='text-[#f78c6c]'>messages</span>
            <span className='text-white/65'>=[</span>
            {'\n        '}
            <span className='text-white/65'>{'{'}</span>
            <span className='text-[#c3e88d]'>"role"</span>
            <span className='text-white/65'>: </span>
            <span className='text-[#c3e88d]'>"user"</span>
            <span className='text-white/65'>, </span>
            <span className='text-[#c3e88d]'>"content"</span>
            <span className='text-white/65'>: </span>
            <span className='text-[#c3e88d]'>"Hello!"</span>
            <span className='text-white/65'>{'}'}</span>
            {'\n    '}
            <span className='text-white/65'>],</span>
            {'\n'}
            <span className='text-white/75'>)</span>
            {'\n\n'}
            <span className='text-[#82aaff]'>print</span>
            <span className='text-white/75'>
              (response.choices[0].message.content)
            </span>
          </code>
        </pre>
      </div>

      <div className='flex items-center gap-2 border-t border-white/8 bg-white/[0.025] px-4 py-2.5 font-mono text-[10px] text-white/35'>
        <span className='size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]' />
        {t('OpenAI SDK compatible')}
      </div>
    </div>
  )
}
