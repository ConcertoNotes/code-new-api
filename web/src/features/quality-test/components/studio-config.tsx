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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BookmarkPlus, Play, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { handleServerError } from '@/lib/handle-server-error'

import { createQualityTestJob } from '../api'
import {
  PELICAN_PROMPT,
  QUALITY_TEST_BUILTIN_PRESETS,
  QUALITY_TEST_ENDPOINT_LABELS,
  QUALITY_TEST_PROMPT_BYTE_LIMIT,
} from '../constants'
import {
  qualityTestQueryKeys,
  useQualityTestOptions,
} from '../hooks/use-quality-test-queries'
import {
  formatQualityTestEffort,
  matchQualityTestPreset,
  utf8ByteLength,
} from '../lib/quality-test'
import {
  filterQualityTestChannels,
  qualityTestChannelTypeName,
  resolveQualityTestEffort,
  resolveQualityTestModel,
} from '../lib/selection'
import type { QualityTestJob, QualityTestPrompt } from '../types'
import type { PresetDraft } from './preset-editor-dialog'
import { StepHeading } from './step-heading'

const CUSTOM_PRESET_VALUE = 'custom'

type StudioConfigProps = {
  prompt: string
  onPromptChange: (prompt: string) => void
  presets: QualityTestPrompt[]
  presetsLoading: boolean
  activeJobs: QualityTestJob[]
  concurrencyLimit: number
  onEditPreset: (draft: PresetDraft) => void
  onStarted: (job: QualityTestJob) => void
}

export function StudioConfig(props: StudioConfigProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const optionsQuery = useQualityTestOptions()
  const [groupName, setGroupName] = useState('')
  const [search, setSearch] = useState('')
  const [channelId, setChannelId] = useState<number>()
  const [model, setModel] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [effort, setEffort] = useState('high')

  // 选择项不再可用时回退到默认值，避免在副作用中同步状态
  const groups = optionsQuery.data?.groups ?? []
  const group = groups.find((item) => item.name === groupName) ?? groups[0]
  const channels = filterQualityTestChannels(group, search)
  const channel = group?.channels.find((item) => item.id === channelId)
  const selectedModel = resolveQualityTestModel(channel, model)
  const selectedEndpoint = endpoint || channel?.default_endpoint || 'openai'
  const efforts = optionsQuery.data?.reasoning_efforts[selectedEndpoint] ?? ['']
  const selectedEffort = resolveQualityTestEffort(efforts, effort)

  const presetMatch = matchQualityTestPreset(props.prompt, props.presets)
  let presetValue = CUSTOM_PRESET_VALUE
  if (presetMatch.kind === 'custom') presetValue = String(presetMatch.preset.id)
  if (presetMatch.kind === 'builtin') presetValue = `builtin:${presetMatch.key}`

  const promptBytes = utf8ByteLength(props.prompt)
  const promptTooLong = promptBytes > QUALITY_TEST_PROMPT_BYTE_LIMIT
  const slotsFull = props.activeJobs.length >= props.concurrencyLimit
  const channelBusy = props.activeJobs.some(
    (job) => job.channel_id === channel?.id
  )

  const createMutation = useMutation({
    mutationFn: createQualityTestJob,
    onSuccess: async (job) => {
      toast.success(t('Test started in the background'))
      await queryClient.invalidateQueries({
        queryKey: qualityTestQueryKeys.jobs(),
      })
      props.onStarted(job)
    },
    onError: async (error) => {
      handleServerError(error)
      await queryClient.invalidateQueries({
        queryKey: qualityTestQueryKeys.jobs(),
      })
    },
  })

  const canStart =
    !createMutation.isPending &&
    Boolean(group && channel && selectedModel) &&
    Boolean(props.prompt.trim()) &&
    !promptTooLong &&
    !slotsFull &&
    !channelBusy

  const startTest = () => {
    if (!canStart || !group || !channel) return
    createMutation.mutate({
      group: group.name,
      channel_id: channel.id,
      model: selectedModel,
      endpoint_type: selectedEndpoint,
      reasoning_effort: selectedEffort,
      prompt: props.prompt,
      prompt_id:
        presetMatch.kind === 'custom' ? presetMatch.preset.id : undefined,
      preset_key: presetMatch.kind === 'builtin' ? presetMatch.key : undefined,
      preset_name:
        presetMatch.kind === 'builtin' ? t(presetMatch.nameKey) : undefined,
    })
  }

  const applyPreset = (value: string) => {
    if (value.startsWith('builtin:')) {
      const builtin = QUALITY_TEST_BUILTIN_PRESETS.find(
        (item) => `builtin:${item.key}` === value
      )
      if (builtin) props.onPromptChange(builtin.prompt)
      return
    }
    const preset = props.presets.find((item) => String(item.id) === value)
    if (preset) props.onPromptChange(preset.prompt)
  }

  let channelHint = t('{{count}} channels in this group', {
    count: group?.channels.length ?? 0,
  })
  if (!optionsQuery.isLoading && channels.length === 0) {
    channelHint = t('No matching channels. Adjust the search or group.')
  }

  let startLabel = t('Start test')
  if (createMutation.isPending) startLabel = t('Submitting...')
  else if (channelBusy) startLabel = t('This channel is already being tested')
  else if (slotsFull) startLabel = t('All test slots are busy')

  return (
    <section
      aria-labelledby='quality-config-title'
      className='bg-card ring-foreground/10 flex flex-col gap-4 rounded-xl p-4 ring-1 lg:sticky lg:top-0'
    >
      <StepHeading
        id='quality-config-title'
        step='01'
        title={t('Test configuration')}
      />
      {optionsQuery.error && (
        <div
          role='alert'
          className='text-destructive flex items-center justify-between gap-2 text-sm'
        >
          {optionsQuery.error.message}
          <Button
            size='sm'
            variant='outline'
            onClick={() => void optionsQuery.refetch()}
          >
            {t('Retry')}
          </Button>
        </div>
      )}
      <fieldset
        disabled={createMutation.isPending}
        className='flex flex-col gap-1.5'
      >
        <Label htmlFor='quality-group'>{t('Group')}</Label>
        <NativeSelect
          id='quality-group'
          className='w-full'
          value={group?.name ?? ''}
          disabled={optionsQuery.isLoading || groups.length === 0}
          onChange={(event) => {
            setGroupName(event.target.value)
            setChannelId(undefined)
            setSearch('')
            setModel('')
            setEndpoint('')
          }}
        >
          {groups.length === 0 && (
            <NativeSelectOption value=''>
              {optionsQuery.isLoading
                ? t('Loading...')
                : t('No groups with channels')}
            </NativeSelectOption>
          )}
          {groups.map((item) => (
            <NativeSelectOption key={item.name} value={item.name}>
              {item.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <Label htmlFor='quality-channel-search' className='mt-3'>
          {t('Test channel')}
        </Label>
        <Input
          id='quality-channel-search'
          type='search'
          value={search}
          placeholder={t('Search channel name, ID or type')}
          onChange={(event) => setSearch(event.target.value)}
        />
        <NativeSelect
          aria-label={t('Test channel')}
          className='w-full'
          value={channel ? String(channel.id) : ''}
          disabled={!group}
          onChange={(event) => {
            setChannelId(Number(event.target.value) || undefined)
            setModel('')
            setEndpoint('')
          }}
        >
          <NativeSelectOption value=''>
            {t('Select a channel')}
          </NativeSelectOption>
          {channel && !channels.some((item) => item.id === channel.id) && (
            <NativeSelectOption value={String(channel.id)}>
              #{channel.id} {channel.name}
            </NativeSelectOption>
          )}
          {channels.map((item) => (
            <NativeSelectOption key={item.id} value={String(item.id)}>
              {`#${item.id} ${item.name} · ${qualityTestChannelTypeName(item.type)}${item.status === 1 ? '' : ` (${t('Disabled')})`}`}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className='text-muted-foreground text-xs'>{channelHint}</p>

        <Label htmlFor='quality-model' className='mt-3'>
          {t('Test model')}
        </Label>
        <NativeSelect
          id='quality-model'
          className='w-full'
          value={selectedModel}
          disabled={!channel || channel.models.length === 0}
          onChange={(event) => setModel(event.target.value)}
        >
          {!channel && (
            <NativeSelectOption value=''>
              {t('Select a channel first')}
            </NativeSelectOption>
          )}
          {channel?.models.length === 0 && (
            <NativeSelectOption value=''>
              {t('This channel has no models')}
            </NativeSelectOption>
          )}
          {channel?.models.map((item) => (
            <NativeSelectOption key={item} value={item}>
              {item}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <Label htmlFor='quality-endpoint' className='mt-3'>
          {t('Request endpoint')}
        </Label>
        <NativeSelect
          id='quality-endpoint'
          className='w-full'
          value={selectedEndpoint}
          disabled={!channel}
          onChange={(event) => setEndpoint(event.target.value)}
        >
          {Object.entries(QUALITY_TEST_ENDPOINT_LABELS).map(
            ([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            )
          )}
        </NativeSelect>

        <Label htmlFor='quality-effort' className='mt-3'>
          {t('Reasoning effort')}
        </Label>
        <NativeSelect
          id='quality-effort'
          className='w-full'
          value={selectedEffort}
          disabled={!channel || efforts.length < 2}
          onChange={(event) => setEffort(event.target.value)}
        >
          {efforts.map((item) => (
            <NativeSelectOption key={item || 'default'} value={item}>
              {formatQualityTestEffort(t, item)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className='text-muted-foreground text-xs'>
          {t(
            'Requests use the selected effort; the upstream model decides which levels it honors.'
          )}
        </p>

        <Label htmlFor='quality-preset' className='mt-3'>
          {t('Prompt preset')}
        </Label>
        <NativeSelect
          id='quality-preset'
          className='w-full'
          value={presetValue}
          onChange={(event) => applyPreset(event.target.value)}
        >
          {QUALITY_TEST_BUILTIN_PRESETS.map((item) => (
            <NativeSelectOption key={item.key} value={`builtin:${item.key}`}>
              {item.key === 'pelican'
                ? t('Default · {{name}}', { name: t(item.nameKey) })
                : t('Built-in · {{name}}', { name: t(item.nameKey) })}
            </NativeSelectOption>
          ))}
          {props.presets.map((item) => (
            <NativeSelectOption key={item.id} value={String(item.id)}>
              {item.name}
            </NativeSelectOption>
          ))}
          {presetValue === CUSTOM_PRESET_VALUE && (
            <NativeSelectOption value={CUSTOM_PRESET_VALUE}>
              {t('Custom prompt (unsaved)')}
            </NativeSelectOption>
          )}
        </NativeSelect>
        <p className='text-muted-foreground text-xs'>
          {props.presets.length === 0 && !props.presetsLoading
            ? t(
                'No presets yet. Add one on the Prompt presets tab, or save the current prompt as a preset.'
              )
            : t(
                'Picking a preset fills the prompt below; editing the text turns it into a custom prompt.'
              )}
        </p>

        <div className='mt-3 flex items-center justify-between gap-2'>
          <Label htmlFor='quality-prompt'>{t('Test prompt')}</Label>
          <span className='flex items-center'>
            <Button
              type='button'
              variant='ghost'
              size='xs'
              disabled={!props.prompt.trim() || promptTooLong}
              onClick={() =>
                props.onEditPreset(
                  presetMatch.kind === 'custom'
                    ? {
                        id: presetMatch.preset.id,
                        name: presetMatch.preset.name,
                        prompt: props.prompt,
                      }
                    : { name: '', prompt: props.prompt }
                )
              }
            >
              <BookmarkPlus aria-hidden='true' />
              {presetMatch.kind === 'custom'
                ? t('Update preset')
                : t('Save as preset')}
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='xs'
              onClick={() => props.onPromptChange(PELICAN_PROMPT)}
            >
              {t('Restore pelican prompt')}
            </Button>
          </span>
        </div>
        <Textarea
          id='quality-prompt'
          rows={5}
          value={props.prompt}
          aria-invalid={promptTooLong}
          onChange={(event) => props.onPromptChange(event.target.value)}
          className='min-h-28'
        />
        <p className='text-muted-foreground text-xs'>
          {t(
            'The model is asked for a standalone HTML page with all SVG, styles and scripts inline. You can edit the prompt.'
          )}
        </p>
        {promptTooLong && (
          <p role='alert' className='text-destructive text-xs'>
            {t('The prompt cannot exceed 16000 bytes.')}
          </p>
        )}
      </fieldset>
      <Button
        size='lg'
        className='w-full'
        disabled={!canStart}
        onClick={startTest}
      >
        {createMutation.isPending ? (
          <RefreshCw aria-hidden='true' className='animate-spin' />
        ) : (
          <Play aria-hidden='true' />
        )}
        {startLabel}
      </Button>
      <p className='text-muted-foreground text-xs'>
        {t(
          'Tests run in the background; leaving this page does not stop them. Up to {{count}} tests run at once, one per channel.',
          { count: props.concurrencyLimit }
        )}
      </p>
    </section>
  )
}
