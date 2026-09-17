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

For commercial licensing, please contact support@quantumnous.com
*/
import { Lightbulb, Link2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IconBadge } from '@/components/ui/icon-badge'

/**
 * 右侧说明面板：新增渠道自动同步提示 + 利润计算逻辑
 */
export function ProfitFormulaPanel() {
  const { t } = useTranslation()
  const formulas = [
    t('Revenue = quota actually charged to users (already includes the group ratio)'),
    t('Upstream cost = official price quota × upstream ratio'),
    t('Realtime profit = revenue − upstream cost'),
    t('Profit margin = realtime profit / revenue × 100%'),
  ]

  return (
    <div className='flex flex-col gap-3'>
      <div className='bg-info/5 border-info/20 flex gap-3 rounded-2xl border p-4'>
        <IconBadge tone='info' size='lg' decorative>
          <Link2 aria-hidden='true' />
        </IconBadge>
        <div className='min-w-0'>
          <div className='text-info text-sm font-semibold'>
            {t('New channels sync automatically')}
          </div>
          <p className='text-muted-foreground mt-1 text-xs leading-relaxed'>
            {t(
              'Every channel is listed here as soon as it is created. Usage logs are matched by channel and group, so a channel in several groups is counted separately for each group.'
            )}
          </p>
        </div>
      </div>

      <div className='bg-card rounded-2xl border p-4 shadow-xs'>
        <div className='flex items-center gap-2'>
          <IconBadge tone='success' size='md' decorative>
            <Lightbulb aria-hidden='true' />
          </IconBadge>
          <span className='text-sm font-semibold'>
            {t('How profit is calculated')}
          </span>
        </div>
        <ul className='mt-3 space-y-2'>
          {formulas.map((formula) => (
            <li
              key={formula}
              className='bg-muted/40 rounded-lg px-3 py-2 font-mono text-xs leading-relaxed'
            >
              {formula}
            </li>
          ))}
        </ul>
        <p className='text-muted-foreground mt-3 text-[11px] leading-relaxed'>
          {t(
            'Upstream ratio is the price you pay upstream relative to the official price; edit it inline in the table. Logs without an official price fall back to reversing the recorded group ratio.'
          )}
        </p>
      </div>
    </div>
  )
}
