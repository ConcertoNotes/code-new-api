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
import { Check, Pencil, X } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { formatRatio } from '../lib/profit'

interface UpstreamRatioCellProps {
  channelId: number
  channelName: string
  ratio: number
  saving?: boolean
  onSave: (ratio: number) => Promise<void> | void
}

/**
 * 表格内的上游倍率编辑单元格：点击铅笔进入编辑，回车/对勾保存，Esc/叉取消
 */
export function UpstreamRatioCell(props: UpstreamRatioCellProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [invalid, setInvalid] = useState(false)

  const startEditing = () => {
    setDraft(formatRatio(props.ratio))
    setInvalid(false)
    setEditing(true)
  }

  const cancel = () => {
    setEditing(false)
    setInvalid(false)
  }

  const submit = async () => {
    const parsed = Number(draft.trim())
    if (draft.trim() === '' || !Number.isFinite(parsed) || parsed < 0) {
      setInvalid(true)
      return
    }
    await props.onSave(parsed)
    setEditing(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void submit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    }
  }

  if (!editing) {
    return (
      <div className='flex items-center gap-1'>
        <span className='font-mono tabular-nums'>
          {formatRatio(props.ratio)}
        </span>
        <Button
          type='button'
          variant='ghost'
          size='icon-xs'
          aria-label={t('Edit upstream ratio of {{name}}', {
            name: props.channelName,
          })}
          onClick={startEditing}
        >
          <Pencil />
        </Button>
      </div>
    )
  }

  return (
    <div className='flex items-center gap-1'>
      <Input
        type='number'
        inputMode='decimal'
        min={0}
        step='0.01'
        value={draft}
        autoFocus
        aria-invalid={invalid || undefined}
        aria-label={t('Upstream ratio of {{name}}', {
          name: props.channelName,
        })}
        className='h-7 w-20 px-2 text-sm'
        disabled={props.saving}
        onChange={(event) => {
          setDraft(event.target.value)
          setInvalid(false)
        }}
        onKeyDown={handleKeyDown}
      />
      <Button
        type='button'
        variant='ghost'
        size='icon-xs'
        aria-label={t('Save')}
        disabled={props.saving}
        onClick={() => void submit()}
      >
        <Check className='text-success' />
      </Button>
      <Button
        type='button'
        variant='ghost'
        size='icon-xs'
        aria-label={t('Cancel')}
        disabled={props.saving}
        onClick={cancel}
      >
        <X />
      </Button>
    </div>
  )
}
