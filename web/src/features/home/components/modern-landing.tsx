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
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { VARIABLE_SWITCH_URL } from '@/hooks/top-nav-link-data'

import { CodePreview } from './code-preview'
import { ModelMarquee } from './model-marquee'

interface ModernLandingProps {
  isAuthenticated: boolean
}

const PAIN_POINTS = [
  'One integration for every model',
  'Predictable routing and failover',
  'Every request tracked for billing',
] as const

export function ModernLanding(props: ModernLandingProps) {
  const { t } = useTranslation()
  const actionUrl = props.isAuthenticated ? '/dashboard' : '/sign-up'
  const actionLabel = props.isAuthenticated ? 'Go to Dashboard' : 'Get Started'

  return (
    <main className='home-modern relative isolate flex min-h-svh flex-col overflow-hidden bg-[#0a1020] text-white lg:h-svh'>
      <div className='home-fluid-background pointer-events-none absolute inset-0 -z-20' />
      <div className='home-grid-background pointer-events-none absolute inset-0 -z-10' />

      <section className='flex min-h-0 flex-1 items-center px-5 pt-20 pb-4 sm:px-6 sm:pt-24 sm:pb-5 lg:pt-20 lg:pb-2'>
        <div className='mx-auto grid w-full max-w-6xl items-center gap-7 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10'>
          <div className='max-w-2xl'>
            <div className='home-reveal mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 font-mono text-[10px] text-white/60 uppercase backdrop-blur-md'>
              <span className='size-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.75)]' />
              {t('Built for production AI traffic')}
            </div>

            <h1 className='home-reveal home-reveal-delay-1 text-[clamp(2.5rem,5vw,4.25rem)] leading-[0.98] font-semibold text-balance'>
              {t('One API. Every model. Zero friction.')}
            </h1>
            <p className='home-reveal home-reveal-delay-2 mt-4 max-w-xl text-base leading-7 text-white/55 sm:text-lg sm:leading-8'>
              {t(
                'Connect your application to leading AI models through one fast, OpenAI-compatible gateway.'
              )}
            </p>

            <div className='home-reveal home-reveal-delay-3 mt-5 flex flex-wrap items-center gap-3'>
              <Button
                size='lg'
                className='h-11 bg-white px-4 text-black hover:bg-white/85'
                render={<Link to={actionUrl} />}
              >
                {t(actionLabel)}
                <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
              </Button>
              <Button
                size='lg'
                variant='outline'
                className='h-11 border-white/20 bg-white/[0.06] px-4 text-white backdrop-blur-md hover:border-white/35 hover:bg-white/[0.12] hover:text-white'
                render={
                  <a
                    href={VARIABLE_SWITCH_URL}
                    target='_blank'
                    rel='noopener noreferrer'
                  />
                }
              >
                {t('Variable Switch')}
                <ArrowUpRight aria-hidden='true' data-icon='inline-end' />
              </Button>
            </div>

            <div className='home-reveal home-reveal-delay-4 mt-6 grid gap-3 sm:grid-cols-3'>
              {PAIN_POINTS.map((point, index) => (
                <div
                  key={point}
                  className='flex items-start gap-2 text-xs leading-5 text-white/45'
                >
                  <span className='mt-2 size-1 shrink-0 rounded-full bg-violet-300' />
                  <span>
                    <span className='mr-1 font-mono text-white/20'>
                      0{index + 1}
                    </span>
                    {t(point)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className='home-reveal home-reveal-delay-3 relative'>
            <div className='pointer-events-none absolute -inset-px -z-10 bg-linear-to-r from-violet-500/20 via-transparent to-cyan-400/15 blur-2xl' />
            <CodePreview />
          </div>
        </div>
      </section>

      <ModelMarquee />
    </main>
  )
}
