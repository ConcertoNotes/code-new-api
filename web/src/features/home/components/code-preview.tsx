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
import { Check, Code2, Copy, Leaf } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { copyToClipboard } from '@/lib/copy-to-clipboard'

const EXAMPLES = {
  Python: `from openai import OpenAI

client = OpenAI(
    base_url="https://your-domain.com/v1",
    api_key="sk-your-api-key",
)

response = client.chat.completions.create(
    model="your-model",
    messages=[
        {"role": "user", "content": "Hello, Lulu!"}
    ],
)
print(response.choices[0].message.content)`,
  Curl: `curl https://your-domain.com/v1/chat/completions \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "your-model",
    "messages": [
      {"role": "user", "content": "Hello, Lulu!"}
    ]
  }'`,
  JavaScript: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://your-domain.com/v1",
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await client.chat.completions.create({
  model: "your-model",
  messages: [
    { role: "user", content: "Hello, Lulu!" }
  ],
});
console.log(response.choices[0].message.content);`,
} as const

type Language = keyof typeof EXAMPLES

export function CodePreview() {
  const { t } = useTranslation()
  const [language, setLanguage] = useState<Language>('Python')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle'
  )
  const copyGeneration = useRef(0)

  useEffect(
    () => () => {
      copyGeneration.current += 1
    },
    []
  )

  const handleCopy = async () => {
    const generation = ++copyGeneration.current
    const didCopy = await copyToClipboard(EXAMPLES[language])
    if (copyGeneration.current === generation) {
      setCopyState(didCopy ? 'copied' : 'failed')
    }
  }

  return (
    <div className='lulu-code-window'>
      <div className='lulu-code-heading'>
        <span className='flex items-center gap-2'>
          <Code2 size={16} aria-hidden='true' />
          {t('Quick start')}
        </span>
        <button
          type='button'
          onClick={handleCopy}
          className='lulu-copy lulu-control lulu-control-ghost'
          aria-label={t('Copy code')}
        >
          {copyState === 'copied' ? (
            <Check size={14} aria-hidden='true' />
          ) : (
            <Copy size={14} aria-hidden='true' />
          )}
          {copyState === 'copied' ? t('Copied') : t('Copy code')}
        </button>
      </div>
      <Tabs
        value={language}
        onValueChange={(value) => {
          copyGeneration.current += 1
          setLanguage(value as Language)
          setCopyState('idle')
        }}
      >
        <TabsList
          variant='line'
          className='lulu-code-tabs'
          aria-label={t('Code language')}
        >
          {(Object.keys(EXAMPLES) as Language[]).map((name) => (
            <TabsTrigger key={name} value={name}>
              {name}
            </TabsTrigger>
          ))}
        </TabsList>
        {(Object.keys(EXAMPLES) as Language[]).map((name) => (
          <TabsContent key={name} value={name} className='lulu-code-content'>
            <pre tabIndex={0} aria-label={t('Code example')}>
              <code>{EXAMPLES[name]}</code>
            </pre>
          </TabsContent>
        ))}
      </Tabs>
      <div className='lulu-copy-status' role='status' aria-live='polite'>
        {copyState === 'copied' && t('Copied')}
        {copyState === 'failed' &&
          t('Copy failed. Please select and copy the code.')}
      </div>
      <div className='lulu-code-response'>
        <img
          src='/lulu/logo/lulu-logo.png'
          className='lulu-avatar'
          alt=''
          width={42}
          height={42}
        />
        <div>
          <span className='lulu-response-label'>{t('Example response')}</span>
          <p>{t('Hi! I am Lulu. What can I help you with?')}</p>
        </div>
        <Leaf size={17} aria-hidden='true' />
      </div>
      <div className='lulu-code-footnote'>
        <span aria-hidden='true' />
        {t('OpenAI SDK compatible')}
        <span className='ml-auto'>
          {t('Replace the endpoint, key and model to get started.')}
        </span>
      </div>
    </div>
  )
}
