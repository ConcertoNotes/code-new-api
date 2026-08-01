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
  Analytics01Icon,
  ApiGatewayIcon,
  DashboardSpeed01Icon,
  Invoice01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

const FEATURES = [
  {
    title: 'High Performance',
    description: 'Support for high concurrency with automatic load balancing',
    metric: '10k+',
    metricLabel: 'Concurrent requests',
    icon: DashboardSpeed01Icon,
    className: 'md:col-span-2',
  },
  {
    title: 'Lightning Fast',
    description:
      'Optimized network architecture ensures millisecond response times',
    metric: '<100ms',
    metricLabel: 'Gateway overhead',
    icon: Analytics01Icon,
    className: '',
  },
  {
    title: 'Developer Friendly',
    description: 'Compatible API routes for common AI application workflows',
    metric: '/v1',
    metricLabel: 'Unified endpoint',
    icon: ApiGatewayIcon,
    className: '',
  },
  {
    title: 'Transparent Billing',
    description: 'Pay-as-you-go with real-time usage monitoring',
    metric: '100%',
    metricLabel: 'Usage traceability',
    icon: Invoice01Icon,
    className: 'md:col-span-2',
  },
] as const

export function BentoFeatures() {
  const { t } = useTranslation()

  return (
    <section className='relative px-5 py-24 sm:px-6 lg:py-32'>
      <div className='mx-auto max-w-6xl'>
        <div className='mb-12 max-w-2xl'>
          <p className='mb-3 font-mono text-xs text-violet-300 uppercase'>
            {t('Infrastructure that stays out of your way')}
          </p>
          <h2 className='text-3xl leading-tight font-semibold text-white sm:text-4xl'>
            {t('Everything you need to ship reliable AI products')}
          </h2>
        </div>

        <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className={`home-bento-card group relative min-h-64 overflow-hidden rounded-lg border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md ${feature.className}`}
            >
              <div className='relative flex h-full flex-col'>
                <div className='mb-10 flex size-9 items-center justify-center rounded-md border border-violet-300/15 bg-violet-400/8 text-violet-200'>
                  <HugeiconsIcon icon={feature.icon} size={19} />
                </div>
                <div className='mt-auto'>
                  <div className='mb-5 flex items-end gap-3 border-b border-white/8 pb-5'>
                    <span className='font-mono text-3xl text-white'>
                      {feature.metric}
                    </span>
                    <span className='pb-1 text-xs text-white/40'>
                      {t(feature.metricLabel)}
                    </span>
                  </div>
                  <h3 className='mb-2 text-base font-medium text-white'>
                    {t(feature.title)}
                  </h3>
                  <p className='max-w-md text-sm leading-6 text-white/48'>
                    {t(feature.description)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
