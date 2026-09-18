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
import { Clock, Info } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { CodeSample } from './code-sample'
import {
  buildImageToVideoExamples,
  buildVideoPollExamples,
  buildVideoSubmitExamples,
  type ExampleLanguage,
  exampleLanguageLabels,
} from './video-generation-examples'
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

export function VideoGenerationDocumentation() {
  const { t } = useTranslation()
  const baseUrl = useApiBaseUrl()

  const submitExamples = useMemo(
    () => buildVideoSubmitExamples(baseUrl),
    [baseUrl]
  )
  const pollExamples = useMemo(
    () => buildVideoPollExamples(baseUrl),
    [baseUrl]
  )
  const imageToVideoExamples = useMemo(
    () => buildImageToVideoExamples(baseUrl),
    [baseUrl]
  )

  const submitParameters: ParameterRow[] = [
    {
      name: 'model',
      type: 'string',
      required: true,
      description: t('docs.video.parameters.model'),
    },
    {
      name: 'prompt',
      type: 'string',
      required: true,
      description: t('docs.video.parameters.prompt'),
    },
    {
      name: 'image_url',
      type: 'string',
      required: false,
      description: t('docs.video.parameters.imageUrl'),
    },
    {
      name: 'duration',
      type: 'integer',
      required: false,
      description: t('docs.video.parameters.duration'),
    },
    {
      name: 'aspect_ratio',
      type: 'string',
      required: false,
      description: t('docs.video.parameters.aspectRatio'),
    },
    {
      name: 'n',
      type: 'integer',
      required: false,
      description: t('docs.video.parameters.n'),
    },
    {
      name: 'negative_prompt',
      type: 'string',
      required: false,
      description: t('docs.video.parameters.negativePrompt'),
    },
    {
      name: 'cfg_scale',
      type: 'number',
      required: false,
      description: t('docs.video.parameters.cfgScale'),
    },
  ]

  const taskResponseFields: ParameterRow[] = [
    {
      name: 'id',
      type: 'string',
      required: true,
      description: t('docs.video.response.id'),
    },
    {
      name: 'status',
      type: 'string',
      required: true,
      description: t('docs.video.response.status'),
    },
    {
      name: 'data',
      type: 'array',
      required: false,
      description: t('docs.video.response.data'),
    },
    {
      name: 'error',
      type: 'string',
      required: false,
      description: t('docs.video.response.error'),
    },
    {
      name: 'created',
      type: 'integer',
      required: true,
      description: t('docs.video.response.created'),
    },
  ]

  const submitResponseExample = `{
  "id": "task_a1b2c3d4e5f6",
  "status": "pending",
  "created": 1787443200
}`

  const completedResponseExample = `{
  "id": "task_a1b2c3d4e5f6",
  "status": "succeeded",
  "created": 1787443200,
  "data": [
    {
      "url": "https://example.com/generated/video.mp4",
      "duration": 5,
      "width": 1920,
      "height": 1080
    }
  ]
}`

  return (
    <article className='space-y-12'>
      <header className='space-y-4 border-b pb-8'>
        <div className='flex flex-wrap items-center gap-2'>
          <Badge variant='secondary'>POST</Badge>
          <code className='text-muted-foreground font-mono text-sm'>
            /v1/video/generations
          </code>
        </div>
        <h1 className='text-3xl font-semibold sm:text-4xl'>
          {t('docs.video.title')}
        </h1>
        <p className='text-muted-foreground max-w-3xl text-base leading-7'>
          {t('docs.video.description')}
        </p>
        <div className='flex flex-wrap gap-x-6 gap-y-2 text-sm'>
          <span>
            <strong>{t('docs.video.modelsLabel')}</strong> kling-v1, kling-v1-5,
            wan-2.1, sora, runway-gen3
          </span>
          <span>
            <strong>{t('docs.video.durationsLabel')}</strong> 5s, 10s
          </span>
          <span>
            <strong>{t('docs.video.formatsLabel')}</strong> MP4
          </span>
        </div>
      </header>

      <section className='space-y-4' id='async-pattern'>
        <h2 className='text-2xl font-semibold'>
          {t('docs.video.asyncPattern')}
        </h2>
        <Alert>
          <Clock className='size-4' aria-hidden='true' />
          <AlertTitle>{t('docs.video.asyncTitle')}</AlertTitle>
          <AlertDescription>{t('docs.video.asyncDescription')}</AlertDescription>
        </Alert>
        <div className='bg-border grid gap-px overflow-hidden rounded-md border sm:grid-cols-3'>
          {[
            ['1', t('docs.video.step1Title'), t('docs.video.step1Detail')],
            ['2', t('docs.video.step2Title'), t('docs.video.step2Detail')],
            ['3', t('docs.video.step3Title'), t('docs.video.step3Detail')],
          ].map(([step, title, detail]) => (
            <div key={step} className='bg-background p-4'>
              <p className='text-primary font-semibold'>Step {step}</p>
              <p className='mt-1 font-medium'>{title}</p>
              <p className='text-muted-foreground mt-1 text-sm'>{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className='space-y-4' id='text-to-video'>
        <h2 className='text-2xl font-semibold'>{t('docs.video.textToVideo')}</h2>
        <p className='text-muted-foreground leading-7'>
          {t('docs.video.textToVideoDescription')}
        </p>
        <ExampleTabs examples={submitExamples} />
      </section>

      <section className='space-y-4' id='submit-parameters'>
        <h2 className='text-2xl font-semibold'>
          {t('docs.video.submitParameters')}
        </h2>
        <ParameterTable rows={submitParameters} />
      </section>

      <section className='space-y-4' id='submit-response'>
        <h2 className='text-2xl font-semibold'>
          {t('docs.video.submitResponse')}
        </h2>
        <p className='text-muted-foreground leading-7'>
          {t('docs.video.submitResponseDescription')}
        </p>
        <CodeSample code={submitResponseExample} label='JSON' />
      </section>

      <section className='space-y-4' id='polling'>
        <div className='flex flex-wrap items-center gap-2'>
          <h2 className='mr-2 text-2xl font-semibold'>
            {t('docs.video.polling')}
          </h2>
          <Badge variant='secondary'>GET</Badge>
          <code className='text-muted-foreground font-mono text-sm'>
            /v1/video/generations/{'{task_id}'}
          </code>
        </div>
        <p className='text-muted-foreground leading-7'>
          {t('docs.video.pollingDescription')}
        </p>
        <ExampleTabs examples={pollExamples} />
        <div className='flex flex-wrap gap-2'>
          {['pending', 'processing', 'succeeded', 'failed'].map((s) => (
            <Badge
              key={s}
              variant={
                s === 'succeeded'
                  ? 'default'
                  : s === 'failed'
                    ? 'destructive'
                    : 'secondary'
              }
              className='font-mono'
            >
              {s}
            </Badge>
          ))}
        </div>
      </section>

      <section className='space-y-4' id='completed-response'>
        <h2 className='text-2xl font-semibold'>
          {t('docs.video.completedResponse')}
        </h2>
        <ParameterTable rows={taskResponseFields} />
        <CodeSample code={completedResponseExample} label='JSON' />
      </section>

      <section className='space-y-4' id='image-to-video'>
        <h2 className='text-2xl font-semibold'>
          {t('docs.video.imageToVideo')}
        </h2>
        <p className='text-muted-foreground leading-7'>
          {t('docs.video.imageToVideoDescription')}
        </p>
        <ExampleTabs examples={imageToVideoExamples} />
      </section>

      <section className='space-y-4' id='models'>
        <h2 className='text-2xl font-semibold'>{t('docs.video.models')}</h2>
        <div className='border-border divide-border divide-y overflow-hidden rounded-md border text-sm'>
          {[
            ['kling-v1', 'Kling v1', '5s / 10s', '1:1, 16:9, 9:16'],
            ['kling-v1-5', 'Kling v1.5', '5s / 10s', '1:1, 16:9, 9:16'],
            ['wan-2.1', 'Wan 2.1', '5s', '16:9, 9:16'],
            ['sora', 'OpenAI Sora', '5s / 10s / 20s', '16:9, 1:1, 9:16'],
            ['runway-gen3', 'Runway Gen-3 Alpha', '5s / 10s', '16:9, 9:16'],
          ].map(([id, name, durations, ratios]) => (
            <div key={id} className='grid grid-cols-4 px-4 py-3'>
              <code className='font-mono text-xs'>{id}</code>
              <span className='font-medium'>{name}</span>
              <span className='text-muted-foreground'>{durations}</span>
              <span className='text-muted-foreground font-mono text-xs'>
                {ratios}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className='space-y-4' id='aspect-ratios'>
        <h2 className='text-2xl font-semibold'>
          {t('docs.video.aspectRatios')}
        </h2>
        <p className='text-muted-foreground leading-7'>
          {t('docs.video.aspectRatiosDescription')}
        </p>
        <div className='flex flex-wrap gap-2'>
          {['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'].map((ratio) => (
            <Badge key={ratio} variant='outline' className='font-mono'>
              {ratio}
            </Badge>
          ))}
        </div>
      </section>

      <section className='space-y-4' id='notes'>
        <h2 className='text-2xl font-semibold'>
          {t('docs.video.importantNotes')}
        </h2>
        <Alert>
          <Info className='size-4' aria-hidden='true' />
          <AlertTitle>{t('docs.video.notesTitle')}</AlertTitle>
          <AlertDescription>
            {t('docs.video.notesDescription')}
          </AlertDescription>
        </Alert>
        <ul className='text-muted-foreground list-disc space-y-2 pl-5 text-sm leading-6'>
          <li>{t('docs.video.noteAsync')}</li>
          <li>{t('docs.video.noteTimeout')}</li>
          <li>{t('docs.video.notePoll')}</li>
          <li>{t('docs.video.noteModel')}</li>
          <li>{t('docs.video.noteBilling')}</li>
        </ul>
      </section>
    </article>
  )
}
