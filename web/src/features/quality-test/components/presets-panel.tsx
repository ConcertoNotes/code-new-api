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
import {
  ArrowUpRight,
  CopyPlus,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Wand2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTimeObject } from '@/lib/time'

import { QUALITY_TEST_BUILTIN_PRESETS } from '../constants'
import type { QualityTestPrompt } from '../types'
import type { PresetDraft } from './preset-editor-dialog'

type PresetsPanelProps = {
  presets: QualityTestPrompt[]
  loading: boolean
  onUse: (prompt: string) => void
  onEdit: (draft: PresetDraft) => void
  onDelete: (preset: QualityTestPrompt) => void
}

const CARD_CLASS =
  'bg-card ring-foreground/10 flex flex-col gap-3 rounded-xl p-4 ring-1 transition-shadow hover:shadow-sm'

export function PresetsPanel(props: PresetsPanelProps) {
  const { t } = useTranslation()
  return (
    <section
      aria-labelledby='quality-presets-title'
      className='flex flex-col gap-4'
    >
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h3 id='quality-presets-title' className='text-sm font-semibold'>
            {t('Prompt presets')}
          </h3>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Save frequently used test prompts and reuse them in the studio.'
            )}
          </p>
        </div>
        <div className='flex items-center gap-2'>
          {props.presets.length > 0 && (
            <Badge variant='secondary'>{props.presets.length}</Badge>
          )}
          <Button
            size='sm'
            onClick={() => props.onEdit({ name: '', prompt: '' })}
          >
            <Plus aria-hidden='true' />
            {t('New preset')}
          </Button>
        </div>
      </div>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
        {QUALITY_TEST_BUILTIN_PRESETS.map((builtin) => (
          <article key={builtin.key} className={CARD_CLASS}>
            <div className='flex min-w-0 flex-col gap-1.5'>
              <h4 className='flex items-center gap-1.5 text-sm font-medium'>
                <Lock
                  aria-hidden='true'
                  className='text-muted-foreground size-3.5'
                />
                <span className='truncate'>{t(builtin.nameKey)}</span>
                <Badge variant='outline'>
                  {builtin.key === 'pelican' ? t('Default') : t('Built-in')}
                </Badge>
              </h4>
              <p className='text-muted-foreground line-clamp-3 text-xs'>
                {builtin.prompt}
              </p>
            </div>
            <div className='mt-auto flex items-center justify-between gap-2'>
              <Button
                size='sm'
                variant='secondary'
                onClick={() => props.onUse(builtin.prompt)}
              >
                <Wand2 aria-hidden='true' />
                {t('Use')}
                <ArrowUpRight aria-hidden='true' />
              </Button>
              <Button
                size='icon-sm'
                variant='ghost'
                aria-label={t('Copy as new preset')}
                title={t('Copy as new preset')}
                onClick={() =>
                  props.onEdit({
                    name: t(builtin.nameKey),
                    prompt: builtin.prompt,
                  })
                }
              >
                <CopyPlus />
              </Button>
            </div>
          </article>
        ))}
        {props.presets.map((preset) => (
          <article key={preset.id} className={CARD_CLASS}>
            <button
              type='button'
              className='flex min-w-0 flex-col gap-1.5 text-left'
              title={t('Edit prompt preset')}
              onClick={() =>
                props.onEdit({
                  id: preset.id,
                  name: preset.name,
                  prompt: preset.prompt,
                })
              }
            >
              <h4 className='truncate text-sm font-medium'>{preset.name}</h4>
              <p className='text-muted-foreground line-clamp-3 text-xs'>
                {preset.prompt}
              </p>
            </button>
            <div className='text-muted-foreground flex items-center justify-between text-xs'>
              <span>
                {t('Used {{count}} times', { count: preset.usage_count })}
              </span>
              <span>
                {formatDateTimeObject(new Date(preset.updated_at * 1000))}
              </span>
            </div>
            <div className='mt-auto flex items-center gap-1'>
              <Button
                size='sm'
                variant='secondary'
                onClick={() => props.onUse(preset.prompt)}
              >
                <Wand2 aria-hidden='true' />
                {t('Use')}
                <ArrowUpRight aria-hidden='true' />
              </Button>
              <span className='flex-1' />
              <Button
                size='icon-sm'
                variant='ghost'
                aria-label={t('Edit prompt preset')}
                title={t('Edit prompt preset')}
                onClick={() =>
                  props.onEdit({
                    id: preset.id,
                    name: preset.name,
                    prompt: preset.prompt,
                  })
                }
              >
                <Pencil />
              </Button>
              <Button
                size='icon-sm'
                variant='ghost'
                className='hover:text-destructive'
                aria-label={t('Delete prompt preset')}
                title={t('Delete prompt preset')}
                onClick={() => props.onDelete(preset)}
              >
                <Trash2 />
              </Button>
            </div>
          </article>
        ))}
        {!props.loading && props.presets.length === 0 && (
          <button
            type='button'
            onClick={() => props.onEdit({ name: '', prompt: '' })}
            className='text-muted-foreground hover:text-foreground hover:border-foreground/30 flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center transition-colors'
          >
            <Plus aria-hidden='true' className='size-5' />
            <strong className='text-sm font-medium'>
              {t('No custom presets yet')}
            </strong>
            <small className='text-xs'>
              {t(
                'Create a preset, or save the current prompt from the studio.'
              )}
            </small>
          </button>
        )}
      </div>
    </section>
  )
}
