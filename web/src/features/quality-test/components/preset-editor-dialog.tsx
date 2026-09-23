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
import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { QUALITY_TEST_PROMPT_BYTE_LIMIT } from '../constants'
import { utf8ByteLength } from '../lib/quality-test'

export type PresetDraft = { id?: number; name: string; prompt: string }

type PresetEditorDialogProps = {
  draft: PresetDraft | null
  saving: boolean
  onChange: (patch: Partial<PresetDraft>) => void
  onClose: () => void
  onSave: () => void
}

/** 预设编辑弹窗：新建与编辑共用，名称留空时由服务端取提示词开头 */
export function PresetEditorDialog(props: PresetEditorDialogProps) {
  const { t } = useTranslation()
  const bytes = props.draft ? utf8ByteLength(props.draft.prompt) : 0
  const tooLong = bytes > QUALITY_TEST_PROMPT_BYTE_LIMIT
  const invalid = !props.draft || !props.draft.prompt.trim() || tooLong
  return (
    <Dialog
      open={Boolean(props.draft)}
      onOpenChange={(open) => {
        if (!open && !props.saving) props.onClose()
      }}
    >
      <DialogContent className='sm:max-w-[640px]'>
        <DialogHeader>
          <DialogTitle>
            {props.draft?.id ? t('Edit prompt preset') : t('New prompt preset')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Save frequently used test prompts and reuse them in the studio.'
            )}
          </DialogDescription>
        </DialogHeader>
        {props.draft && (
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='quality-preset-name'>{t('Preset name')}</Label>
            <Input
              id='quality-preset-name'
              value={props.draft.name}
              maxLength={100}
              placeholder={t('Leave empty to use the beginning of the prompt')}
              onChange={(event) => props.onChange({ name: event.target.value })}
            />
            <div className='mt-3 flex items-center justify-between'>
              <Label htmlFor='quality-preset-prompt'>{t('Prompt')}</Label>
              <span
                className={cn(
                  'text-muted-foreground text-xs',
                  tooLong && 'text-destructive'
                )}
              >
                {t('{{count}} / 16000 bytes', { count: bytes })}
              </span>
            </div>
            <Textarea
              id='quality-preset-prompt'
              rows={8}
              value={props.draft.prompt}
              aria-invalid={tooLong}
              onChange={(event) =>
                props.onChange({ prompt: event.target.value })
              }
              className='min-h-40'
            />
          </div>
        )}
        <DialogFooter>
          <Button
            variant='outline'
            disabled={props.saving}
            onClick={props.onClose}
          >
            {t('Cancel')}
          </Button>
          <Button disabled={props.saving || invalid} onClick={props.onSave}>
            {props.saving && (
              <RefreshCw aria-hidden='true' className='animate-spin' />
            )}
            {props.saving ? t('Saving...') : t('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
