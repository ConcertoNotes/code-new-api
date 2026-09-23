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
import { BookmarkPlus, Check, Lock, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import {
  QUALITY_TEST_BUILTIN_PRESETS,
  QUALITY_TEST_STATUS_LABELS,
} from '../constants'
import { isQualityTestActive } from '../lib/quality-test'
import type { QualityTestJob, QualityTestStatus } from '../types'

const STATUS_TONE: Record<QualityTestStatus | 'idle', string> = {
  idle: 'text-muted-foreground',
  running: 'text-sky-600 dark:text-sky-400',
  cancelling: 'text-amber-600 dark:text-amber-400',
  completed: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-destructive',
  stopped: 'text-muted-foreground',
  interrupted: 'text-amber-600 dark:text-amber-400',
}

type QualityTestStatusBadgeProps = {
  status?: QualityTestStatus
  pill?: boolean
}

export function QualityTestStatusBadge(props: QualityTestStatusBadgeProps) {
  const { t } = useTranslation()
  const status = props.status ?? 'idle'
  let icon = (
    <span aria-hidden='true' className='size-1.5 rounded-full bg-current' />
  )
  if (isQualityTestActive({ status: status as QualityTestStatus })) {
    icon = <RefreshCw aria-hidden='true' className='size-3 animate-spin' />
  } else if (status === 'completed') {
    icon = <Check aria-hidden='true' className='size-3' />
  }
  return (
    <span
      role='status'
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap',
        props.pill && 'bg-muted rounded-full px-2 py-0.5',
        STATUS_TONE[status]
      )}
    >
      {icon}
      {t(QUALITY_TEST_STATUS_LABELS[status])}
    </span>
  )
}

type QualityTestPresetLabelProps = {
  job: Pick<QualityTestJob, 'preset_kind' | 'preset_ref' | 'preset_name'>
}

/** 记录中的预设来源：内置预设按当前语言显示，自定义预设用快照名称，手写提示词显示“手写” */
export function QualityTestPresetLabel(props: QualityTestPresetLabelProps) {
  const { t } = useTranslation()
  if (!props.job.preset_kind) {
    return <Badge variant='outline'>{t('Hand-typed')}</Badge>
  }
  if (props.job.preset_kind === 'builtin') {
    const builtin = QUALITY_TEST_BUILTIN_PRESETS.find(
      (item) => item.key === props.job.preset_ref
    )
    const name = builtin
      ? t(builtin.nameKey)
      : props.job.preset_name || props.job.preset_ref
    return (
      <Badge variant='secondary' title={name} className='max-w-40'>
        <Lock aria-hidden='true' />
        <span className='truncate'>{name}</span>
      </Badge>
    )
  }
  return (
    <Badge
      variant='secondary'
      title={props.job.preset_name}
      className='max-w-40'
    >
      <BookmarkPlus aria-hidden='true' />
      <span className='truncate'>{props.job.preset_name}</span>
    </Badge>
  )
}
