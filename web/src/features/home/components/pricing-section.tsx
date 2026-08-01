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
import { ArrowRight01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

const BILLING_POINTS = [
  'No platform subscription',
  'No minimum commitment',
  'Detailed usage records',
] as const

export function PricingSection() {
  const { t } = useTranslation()

  return (
    <section className='border-y border-white/8 bg-black/20 px-5 py-24 sm:px-6 lg:py-28'>
      <div className='mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_0.9fr]'>
        <div className='max-w-2xl'>
          <p className='mb-3 font-mono text-xs text-cyan-300 uppercase'>
            {t('Usage-based')}
          </p>
          <h2 className='text-3xl leading-tight font-semibold text-white sm:text-4xl'>
            {t('Simple pricing, down to every token')}
          </h2>
          <p className='mt-4 max-w-xl text-base leading-7 text-white/50'>
            {t(
              'Pay only for the model usage you consume, with every request visible in one detailed ledger.'
            )}
          </p>

          <div className='mt-7 flex flex-col gap-3'>
            {BILLING_POINTS.map((point) => (
              <div
                key={point}
                className='flex items-center gap-3 text-sm text-white/65'
              >
                <span className='flex size-5 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/8 text-cyan-200'>
                  <HugeiconsIcon icon={Tick02Icon} size={12} />
                </span>
                {t(point)}
              </div>
            ))}
          </div>
        </div>

        <div className='rounded-lg border border-white/10 bg-white/[0.04] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:p-8'>
          <div className='flex items-start justify-between gap-6'>
            <div>
              <p className='text-sm text-white/45'>{t('Platform fee')}</p>
              <p className='mt-2 font-mono text-5xl text-white'>$0</p>
            </div>
            <span className='rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-white/50 uppercase'>
              {t('Per 1M tokens')}
            </span>
          </div>
          <div className='my-7 h-px bg-white/8' />
          <Button
            size='lg'
            className='h-11 w-full bg-white text-black hover:bg-white/85'
            render={<Link to='/pricing' />}
          >
            {t('View Pricing')}
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
          </Button>
        </div>
      </div>
    </section>
  )
}
