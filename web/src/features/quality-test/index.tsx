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
import { getRouteApi } from '@tanstack/react-router'
import { BookmarkPlus, FlaskConical, History } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'

import { deleteQualityTestPrompt, saveQualityTestPrompt } from './api'
import { ActiveJobs } from './components/active-jobs'
import {
  PresetEditorDialog,
  type PresetDraft,
} from './components/preset-editor-dialog'
import { PresetsPanel } from './components/presets-panel'
import { RecordsPanel } from './components/records-panel'
import { ResultDialog } from './components/result-dialog'
import { StudioConfig } from './components/studio-config'
import { StudioResult, StudioReviewGuide } from './components/studio-result'
import { PELICAN_PROMPT } from './constants'
import {
  qualityTestQueryKeys,
  useQualityTestJobs,
  useQualityTestPrompts,
} from './hooks/use-quality-test-queries'
import type {
  QualityTestJobsFilter,
  QualityTestPrompt,
  QualityTestView,
} from './types'

const route = getRouteApi('/_authenticated/quality-test/')

export function QualityTest() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const view: QualityTestView = search.view ?? 'studio'

  const [prompt, setPrompt] = useState(PELICAN_PROMPT)
  const [recordPage, setRecordPage] = useState(1)
  const [recordFilter, setRecordFilter] = useState<QualityTestJobsFilter>({})
  const [modalId, setModalId] = useState<number>()
  const [presetDraft, setPresetDraft] = useState<PresetDraft | null>(null)
  const [deletingPreset, setDeletingPreset] =
    useState<QualityTestPrompt | null>(null)

  const jobsQuery = useQualityTestJobs(recordPage, recordFilter)
  const promptsQuery = useQualityTestPrompts()
  const presets = promptsQuery.data ?? []
  const activeJobs = jobsQuery.data?.active_jobs ?? []
  const concurrencyLimit = jobsQuery.data?.concurrency_limit ?? 3
  // 结果面板只跟随显式选中（URL job 参数）或正在运行的任务
  const selectedJobId = search.job ?? activeJobs[0]?.id

  const goTo = (next: { view?: QualityTestView; job?: number }) =>
    void navigate({ search: (previous) => ({ ...previous, ...next }) })

  const savePresetMutation = useMutation({
    mutationFn: saveQualityTestPrompt,
    onSuccess: async (saved, draft) => {
      // 编辑的预设若正被工作台使用，同步工作台文本以保持选中关系
      if (
        draft.id &&
        presets.some((item) => item.id === draft.id && item.prompt === prompt)
      ) {
        setPrompt(saved.prompt)
      }
      setPresetDraft(null)
      toast.success(t('Prompt preset saved'))
      await queryClient.invalidateQueries({
        queryKey: qualityTestQueryKeys.prompts(),
      })
    },
    onError: handleServerError,
  })

  const deletePresetMutation = useMutation({
    mutationFn: deleteQualityTestPrompt,
    onSuccess: async () => {
      setDeletingPreset(null)
      toast.success(t('Prompt preset deleted'))
      await queryClient.invalidateQueries({
        queryKey: qualityTestQueryKeys.prompts(),
      })
    },
    onError: handleServerError,
  })

  const applyPrompt = (next: string) => {
    setPrompt(next)
    goTo({ view: 'studio' })
  }

  let content
  if (view === 'presets') {
    content = (
      <PresetsPanel
        presets={presets}
        loading={promptsQuery.isLoading}
        onUse={applyPrompt}
        onEdit={setPresetDraft}
        onDelete={setDeletingPreset}
      />
    )
  } else if (view === 'history') {
    content = (
      <RecordsPanel
        data={jobsQuery.data}
        loading={jobsQuery.isLoading}
        fetching={jobsQuery.isFetching}
        page={recordPage}
        filter={recordFilter}
        selectedId={modalId}
        onPageChange={setRecordPage}
        onFilterChange={(filter) => {
          setRecordFilter(filter)
          setRecordPage(1)
        }}
        onRefresh={() => void jobsQuery.refetch()}
        onOpen={setModalId}
      />
    )
  } else {
    content = (
      <>
        <div className='grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]'>
          <StudioConfig
            prompt={prompt}
            onPromptChange={setPrompt}
            presets={presets}
            presetsLoading={promptsQuery.isLoading}
            activeJobs={activeJobs}
            concurrencyLimit={concurrencyLimit}
            onEditPreset={setPresetDraft}
            onStarted={(job) => goTo({ view: 'studio', job: job.id })}
          />
          <StudioResult jobId={selectedJobId} />
        </div>
        <StudioReviewGuide />
      </>
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        <span className='inline-flex items-center gap-2'>
          {t('Degradation Check')}
          <Badge variant='outline' className='font-mono'>
            <FlaskConical aria-hidden='true' />
            HTML / SVG
          </Badge>
        </span>
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <span className='text-muted-foreground inline-flex items-center gap-1.5 text-xs'>
          <span
            aria-hidden='true'
            className={cn(
              'size-1.5 rounded-full bg-current',
              activeJobs.length > 0 && 'animate-pulse text-sky-500'
            )}
          />
          {t('{{count}} / {{limit}} running', {
            count: activeJobs.length,
            limit: concurrencyLimit,
          })}
        </span>
        <Tabs
          value={view}
          onValueChange={(value) => goTo({ view: value as QualityTestView })}
        >
          <TabsList>
            <TabsTrigger value='studio'>
              <FlaskConical aria-hidden='true' />
              {t('Test studio')}
            </TabsTrigger>
            <TabsTrigger value='presets'>
              <BookmarkPlus aria-hidden='true' />
              {t('Prompt presets')}
            </TabsTrigger>
            <TabsTrigger value='history'>
              <History aria-hidden='true' />
              {t('Test records')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-4'>
          <p className='text-muted-foreground text-xs sm:text-sm'>
            {t(
              'Run the same HTML animation prompt to compare how groups, channels, models and reasoning efforts actually perform.'
            )}
          </p>
          {jobsQuery.error && (
            <div role='alert' className='text-destructive text-sm'>
              {jobsQuery.error.message}
            </div>
          )}
          <ActiveJobs
            jobs={activeJobs}
            selectedId={selectedJobId}
            onSelect={(id) => goTo({ view: 'studio', job: id })}
          />
          {content}
        </div>
      </SectionPageLayout.Content>

      <ResultDialog
        id={modalId}
        onClose={() => setModalId(undefined)}
        onOpenStudio={(id) => {
          setModalId(undefined)
          goTo({ view: 'studio', job: id })
        }}
      />
      <PresetEditorDialog
        draft={presetDraft}
        saving={savePresetMutation.isPending}
        onChange={(patch) =>
          setPresetDraft((current) =>
            current ? { ...current, ...patch } : current
          )
        }
        onClose={() => setPresetDraft(null)}
        onSave={() => {
          if (!presetDraft) return
          savePresetMutation.mutate({
            id: presetDraft.id,
            name: presetDraft.name.trim(),
            prompt: presetDraft.prompt,
          })
        }}
      />
      <ConfirmDialog
        open={Boolean(deletingPreset)}
        onOpenChange={(open) => {
          if (!open) setDeletingPreset(null)
        }}
        title={t('Delete prompt preset')}
        desc={t(
          'Delete preset "{{name}}"? Existing test records keep their snapshot.',
          {
            name: deletingPreset?.name ?? '',
          }
        )}
        confirmText={t('Delete')}
        destructive
        isLoading={deletePresetMutation.isPending}
        handleConfirm={() => {
          if (deletingPreset) deletePresetMutation.mutate(deletingPreset.id)
        }}
      />
    </SectionPageLayout>
  )
}
