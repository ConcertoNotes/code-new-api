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
import { CircleDollarSign, Info } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { CodeSample } from './code-sample'
import {
  buildDataUriEditExample,
  buildEditExamples,
  buildGenerationExamples,
  type ExampleLanguage,
  exampleLanguageLabels,
} from './gpt-image-examples'
import { ParameterTable, type ParameterRow } from './parameter-table'
import { useApiBaseUrl } from './use-api-base-url'

function ExampleTabs(props: { examples: Record<ExampleLanguage, string> }) {
  const [language, setLanguage] = useState<ExampleLanguage>('curl')

  return (
    <div className='space-y-3'>
      <Tabs
        value={language}
        onValueChange={(value) => setLanguage(value as ExampleLanguage)}
      >
        <TabsList>
          {(Object.keys(exampleLanguageLabels) as ExampleLanguage[]).map(
            (item) => (
              <TabsTrigger key={item} value={item}>
                {exampleLanguageLabels[item]}
              </TabsTrigger>
            )
          )}
        </TabsList>
      </Tabs>
      <CodeSample
        code={props.examples[language]}
        label={exampleLanguageLabels[language]}
      />
    </div>
  )
}

export function GptImageDocumentation() {
  const { t } = useTranslation()
  const baseUrl = useApiBaseUrl()
  const generationExamples = useMemo(
    () => buildGenerationExamples(baseUrl),
    [baseUrl]
  )
  const editExamples = useMemo(() => buildEditExamples(baseUrl), [baseUrl])

  const generationParameters: ParameterRow[] = [
    {
      name: 'model',
      type: 'string',
      required: true,
      description: t('docs.gpt.parameters.model'),
    },
    {
      name: 'prompt',
      type: 'string',
      required: true,
      description: t('docs.gpt.parameters.prompt'),
    },
    {
      name: 'n',
      type: 'integer',
      required: false,
      description: t('docs.gpt.parameters.n'),
    },
    {
      name: 'size',
      type: 'string',
      required: false,
      description: t('docs.gpt.parameters.size'),
    },
    {
      name: 'resolution',
      type: 'string',
      required: false,
      description: t('docs.gpt.parameters.resolution'),
    },
    {
      name: 'aspect_ratio',
      type: 'string',
      required: false,
      description: t('docs.gpt.parameters.aspectRatio'),
    },
    {
      name: 'quality',
      type: 'string',
      required: false,
      description: t('docs.gpt.parameters.quality'),
    },
    {
      name: 'response_format',
      type: 'string',
      required: false,
      description: t('docs.gpt.parameters.responseFormat'),
    },
    {
      name: 'stream',
      type: 'boolean',
      required: false,
      description: t('docs.gpt.parameters.stream'),
    },
    {
      name: 'background',
      type: 'string',
      required: false,
      description: t('docs.gpt.parameters.background'),
    },
    {
      name: 'output_format',
      type: 'string',
      required: false,
      description: t('docs.gpt.parameters.outputFormat'),
    },
    {
      name: 'output_compression',
      type: 'integer',
      required: false,
      description: t('docs.gpt.parameters.outputCompression'),
    },
    {
      name: 'watermark',
      type: 'boolean',
      required: false,
      description: t('docs.gpt.parameters.watermark'),
    },
  ]

  const editParameters: ParameterRow[] = [
    {
      name: 'image',
      type: 'file | data URI',
      required: true,
      description: t('docs.gpt.parameters.image'),
    },
    {
      name: 'mask',
      type: 'file | data URI',
      required: false,
      description: t('docs.gpt.parameters.mask'),
    },
    {
      name: 'input_fidelity',
      type: 'string',
      required: false,
      description: t('docs.gpt.parameters.inputFidelity'),
    },
  ]

  const responseExample = `{
  "created": 1787443200,
  "data": [
    {
      "url": "https://example.com/generated/image.png",
      "revised_prompt": "A cinematic city street after rain..."
    }
  ]
}`

  return (
    <article className='space-y-12'>
      <header className='space-y-4 border-b pb-8'>
        <div className='flex flex-wrap items-center gap-2'>
          <Badge variant='secondary'>POST</Badge>
          <code className='text-muted-foreground font-mono text-sm'>
            /v1/images/generations
          </code>
        </div>
        <h1 className='text-3xl font-semibold sm:text-4xl'>gpt-image-2</h1>
        <p className='text-muted-foreground max-w-3xl text-base leading-7'>
          {t('docs.gpt.description')}
        </p>
        <div className='flex flex-wrap gap-x-6 gap-y-2 text-sm'>
          <span>
            <strong>{t('docs.gpt.priceLabel')}</strong> $0.15 /{' '}
            {t('docs.gpt.imageUnit')}
          </span>
          <span>
            <strong>{t('docs.gpt.resolutionsLabel')}</strong> 1K, 2K, 4K
          </span>
          <span>
            <strong>{t('docs.gpt.formatsLabel')}</strong> URL, Base64
          </span>
        </div>
      </header>

      <section className='space-y-4' id='generation'>
        <h2 className='text-2xl font-semibold'>{t('docs.gpt.textToImage')}</h2>
        <p className='text-muted-foreground leading-7'>
          {t('docs.gpt.textToImageDescription')}
        </p>
        <ExampleTabs examples={generationExamples} />
      </section>

      <section className='space-y-4' id='generation-parameters'>
        <h2 className='text-2xl font-semibold'>
          {t('docs.gpt.generationParameters')}
        </h2>
        <ParameterTable rows={generationParameters} />
      </section>

      <section className='space-y-5' id='resolution-routing'>
        <h2 className='text-2xl font-semibold'>
          {t('docs.gpt.automaticRouting')}
        </h2>
        <p className='text-muted-foreground leading-7'>
          {t('docs.gpt.automaticRoutingDescription')}
        </p>
        <div className='bg-border grid gap-px overflow-hidden rounded-md border sm:grid-cols-3'>
          {[
            ['1K', '< 1024 px', 'gpt-image-2-1k'],
            ['2K', '1024 - 2048 px', 'gpt-image-2-2k'],
            ['4K', '2049 - 4096+ px', 'gpt-image-2-4k'],
          ].map(([tier, range, alias]) => (
            <div key={tier} className='bg-background p-4'>
              <p className='font-semibold'>{tier}</p>
              <p className='text-muted-foreground mt-1 text-sm'>{range}</p>
              <code className='text-muted-foreground mt-3 block font-mono text-xs'>
                {alias}
              </code>
            </div>
          ))}
        </div>
        <Alert>
          <Info className='size-4' aria-hidden='true' />
          <AlertTitle>{t('docs.gpt.routingRuleTitle')}</AlertTitle>
          <AlertDescription>
            {t('docs.gpt.routingRuleDescription')}
          </AlertDescription>
        </Alert>
        <div className='space-y-2'>
          <h3 className='text-lg font-semibold'>
            {t('docs.gpt.aspectRatios')}
          </h3>
          <p className='text-muted-foreground leading-7'>
            {t('docs.gpt.aspectRatiosDescription')}
          </p>
          <div className='flex flex-wrap gap-2'>
            {['1:1', '3:4', '4:3', '9:16', '16:9', '9:21', '21:9'].map(
              (ratio) => (
                <Badge key={ratio} variant='outline' className='font-mono'>
                  {ratio}
                </Badge>
              )
            )}
          </div>
        </div>
      </section>

      <section className='space-y-4' id='billing'>
        <h2 className='text-2xl font-semibold'>{t('docs.gpt.billing')}</h2>
        <Alert>
          <CircleDollarSign className='size-4' aria-hidden='true' />
          <AlertTitle>{t('docs.gpt.billingTitle')}</AlertTitle>
          <AlertDescription>
            {t('docs.gpt.billingDescription')}
          </AlertDescription>
        </Alert>
        <div className='border-border divide-border divide-y overflow-hidden rounded-md border text-sm'>
          {['1K', '2K', '4K'].map((tier) => (
            <div
              key={tier}
              className='flex items-center justify-between px-4 py-3'
            >
              <span className='font-medium'>{tier}</span>
              <span className='font-mono'>
                $0.15 / {t('docs.gpt.imageUnit')}
              </span>
            </div>
          ))}
        </div>
        <p className='text-muted-foreground text-sm leading-6'>
          {t('docs.gpt.billingFormula')}
        </p>
      </section>

      <section className='space-y-4' id='edits'>
        <div className='flex flex-wrap items-center gap-2'>
          <h2 className='mr-2 text-2xl font-semibold'>
            {t('docs.gpt.imageEditing')}
          </h2>
          <Badge variant='secondary'>POST</Badge>
          <code className='text-muted-foreground font-mono text-sm'>
            /v1/images/edits
          </code>
        </div>
        <p className='text-muted-foreground leading-7'>
          {t('docs.gpt.imageEditingDescription')}
        </p>
        <ExampleTabs examples={editExamples} />
        <h3 className='pt-2 text-lg font-semibold'>
          {t('docs.gpt.editOnlyParameters')}
        </h3>
        <p className='text-muted-foreground text-sm leading-6'>
          {t('docs.gpt.editSharedParameters')}
        </p>
        <ParameterTable rows={editParameters} />
      </section>

      <section className='space-y-4' id='data-uri'>
        <h2 className='text-2xl font-semibold'>
          {t('docs.gpt.dataUriEditing')}
        </h2>
        <p className='text-muted-foreground leading-7'>
          {t('docs.gpt.dataUriDescription')}
        </p>
        <CodeSample
          code={buildDataUriEditExample(baseUrl)}
          label='cURL · JSON'
        />
      </section>

      <section className='space-y-4' id='response'>
        <h2 className='text-2xl font-semibold'>{t('docs.gpt.response')}</h2>
        <p className='text-muted-foreground leading-7'>
          {t('docs.gpt.responseDescription')}
        </p>
        <CodeSample code={responseExample} label='JSON' />
      </section>

      <section className='space-y-4' id='notes'>
        <h2 className='text-2xl font-semibold'>
          {t('docs.gpt.importantNotes')}
        </h2>
        <ul className='text-muted-foreground list-disc space-y-2 pl-5 text-sm leading-6'>
          <li>{t('docs.gpt.noteDimensions')}</li>
          <li>{t('docs.gpt.noteFallback')}</li>
          <li>{t('docs.gpt.noteCount')}</li>
          <li>{t('docs.gpt.noteTimeout')}</li>
          <li>{t('docs.gpt.noteProvider')}</li>
        </ul>
      </section>
    </article>
  )
}
