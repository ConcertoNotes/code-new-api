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
  Hash,
  Coins,
  Layers,
  Gauge,
  Zap,
  Flame,
  TrendingUp,
  Activity,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { IconBadgeTone } from '@/components/ui/icon-badge'
import { safeDivide } from '@/features/dashboard/lib'

interface StatCardConfig {
  key: string
  title: string
  description: string
  icon: LucideIcon
  iconTone: IconBadgeTone
  getValue: (stat: Record<string, number>, days?: number) => number
}

export function useModelStatCardsConfig(): StatCardConfig[] {
  const { t } = useTranslation()

  return [
    {
      key: 'count',
      title: t('Total Count'),
      description: t('Statistical count'),
      icon: Hash,
      iconTone: 'info',
      getValue: (stat) => stat?.rpm ?? 0,
    },
    {
      key: 'quota',
      title: t('Total Quota'),
      description: t('Statistical quota'),
      icon: Coins,
      iconTone: 'success',
      getValue: (stat) => stat?.quota ?? 0,
    },
    {
      key: 'tokens',
      title: t('Total Tokens'),
      description: t('Statistical tokens'),
      icon: Layers,
      iconTone: 'chart-4',
      getValue: (stat) => stat?.tpm ?? 0,
    },
    {
      key: 'avgRpm',
      title: t('Average RPM'),
      description: t('Requests per minute'),
      icon: Gauge,
      iconTone: 'chart-2',
      getValue: (stat, timeRangeMinutes = 1) =>
        safeDivide(stat?.rpm ?? 0, timeRangeMinutes),
    },
    {
      key: 'avgTpm',
      title: t('Average TPM'),
      description: t('Tokens per minute'),
      icon: Zap,
      iconTone: 'warning',
      getValue: (stat, timeRangeMinutes = 1) =>
        safeDivide(stat?.tpm ?? 0, timeRangeMinutes),
    },
  ]
}

export function useSummaryCardsConfig(totals: {
  recentUsageDisplay: string
  recentOfficialDisplay: string
  totalUsageDisplay: string
  totalOfficialDisplay: string
  recentRequestCountDisplay: string
  totalRequestCountDisplay: string
  recentTokenCountDisplay: string
  recentInputOutputDisplay: string
  totalTokenCountDisplay: string
}) {
  const { t } = useTranslation()

  return [
    {
      key: 'recentUsage',
      title: t('Past 24 hours'),
      value: totals.recentUsageDisplay,
      description: t('Actual billed usage'),
      details: [
        {
          label: t('Official USD'),
          value: totals.recentOfficialDisplay,
        },
      ],
      icon: Flame,
    },
    {
      key: 'usage',
      title: t('Historical Usage'),
      value: totals.totalUsageDisplay,
      description: t('All-time billed usage'),
      details: [
        {
          label: t('Official USD'),
          value: totals.totalOfficialDisplay,
        },
      ],
      icon: TrendingUp,
    },
    {
      key: 'requests',
      title: t('Request Count'),
      value: totals.recentRequestCountDisplay,
      description: t('Requests in the past 24 hours'),
      details: [
        {
          label: t('All-time'),
          value: totals.totalRequestCountDisplay,
        },
      ],
      icon: Activity,
    },
    {
      key: 'tokens',
      title: t('Total Tokens'),
      value: totals.recentTokenCountDisplay,
      description: t('Tokens in the past 24 hours'),
      details: [
        {
          label: t('All-time'),
          value: totals.totalTokenCountDisplay,
        },
        {
          label: t('Input / Output'),
          value: totals.recentInputOutputDisplay,
        },
      ],
      icon: Layers,
    },
  ]
}
