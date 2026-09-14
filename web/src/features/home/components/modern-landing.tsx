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
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Leaf,
  Play,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LuluToolbar } from '@/components/lulu-toolbar'
import { VARIABLE_SWITCH_URL } from '@/hooks/top-nav-link-data'

import { CodePreview } from './code-preview'
import { ModelMarquee } from './model-marquee'

interface ModernLandingProps {
  isAuthenticated: boolean
}

export function ModernLanding(props: ModernLandingProps) {
  const { t } = useTranslation()
  const actionUrl = props.isAuthenticated ? '/dashboard' : '/sign-up'
  const actionLabel = props.isAuthenticated ? 'Go to Dashboard' : 'Start now'
  const features = [
    {
      icon: Leaf,
      title: t('Multi-model collaboration'),
      description: t(
        'Access OpenAI, Claude, GLM, DeepSeek and more with one integration.'
      ),
      detail: t('One API, more possibilities'),
      href: '/pricing',
    },
    {
      icon: Zap,
      title: t('Stable and fast'),
      description: t(
        'Intelligent routing and failover keep your requests running smoothly.'
      ),
      detail: t('Built for your next idea'),
      href: '/docs',
    },
    {
      icon: BarChart3,
      title: t('Clear and transparent'),
      description: t(
        'Understand your usage, costs and model calls at a glance.'
      ),
      detail: t('Every request, in focus'),
      href: '/usage-logs',
    },
  ]

  return (
    <main className='lulu-main bg-background text-foreground'>
      <section className='lulu-hero' aria-labelledby='lulu-headline'>
        <div className='lulu-scene' aria-hidden='true' />
        <div className='lulu-moon-glow' aria-hidden='true' />
        <div className='lulu-fireflies' aria-hidden='true'>
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className='lulu-floating-leaves' aria-hidden='true'>
          <Leaf />
          <Leaf />
          <Leaf />
          <Leaf />
        </div>
        <div className='lulu-container lulu-hero-grid'>
          <div className='lulu-hero-copy'>
            <p className='lulu-eyebrow'>
              <span />
              {t('A little cuter. A lot more productive.')}
              <Leaf size={16} aria-hidden='true' />
            </p>
            <h1 id='lulu-headline'>
              <span>{t('One gateway,')}</span>
              <span>{t('a world of AI.')}</span>
              <span className='lulu-mint'>{t('Meet the softer side.')}</span>
            </h1>
            <p className='lulu-intro'>
              {t(
                'A lighter, friendlier way to connect your AI workflows, models and knowledge.'
              )}
            </p>
            <p className='lulu-subtitle'>
              {t('One integration. All your favorite models.')}
            </p>
            <LuluToolbar className='lulu-hero-actions'>
              <Link to={actionUrl} className='lulu-button lulu-button-primary'>
                {t(actionLabel)}
                <ArrowRight size={18} aria-hidden='true' />
              </Link>
              <a
                href='#lulu-features'
                className='lulu-button lulu-button-glass'
              >
                {t('Explore capabilities')}
                <Play size={14} aria-hidden='true' />
              </a>
            </LuluToolbar>
            <div className='lulu-hero-note'>
              <span className='lulu-status-dot' />
              {t('OpenAI SDK compatible')}
              <span className='lulu-note-divider' />
              {t('Made for developers, with a little warmth.')}
            </div>
          </div>
          <div className='lulu-stage'>
            <div className='lulu-mascot-wrap'>
              <img
                className='lulu-mascot'
                src='/lulu/hero/lulu-main.webp'
                alt={t('Lulu the capybara with a laptop')}
                width={1024}
                height={1024}
                fetchPriority='high'
              />
              <span className='lulu-handwritten' aria-hidden='true'>
                Hello, world <span>↗</span>
              </span>
            </div>
            <img
              className='lulu-lantern'
              src='/lulu/hero/lantern.webp'
              alt=''
              width={180}
              height={250}
            />
            <div className='lulu-stage-code'>
              <CodePreview />
            </div>
          </div>
        </div>
        <div className='lulu-scroll-note' aria-hidden='true'>
          <span />
          {t('Great ideas start with a simple connection')}
        </div>
      </section>

      <section
        id='lulu-features'
        className='lulu-container lulu-features'
        aria-labelledby='lulu-features-title'
      >
        <div className='lulu-section-heading'>
          <div>
            <p className='lulu-kicker'>{t('LESS FRICTION. MORE CREATION.')}</p>
            <h2 id='lulu-features-title'>
              {t('Powerful underneath. Effortless on the surface.')}
            </h2>
          </div>
          <Leaf aria-hidden='true' size={25} />
        </div>
        <div className='lulu-feature-grid'>
          {features.map((feature, index) => (
            <Link
              key={feature.title}
              to={feature.href}
              className='lulu-feature-card'
            >
              <div className='lulu-feature-top'>
                <span className='lulu-feature-icon'>
                  <feature.icon
                    size={24}
                    strokeWidth={1.5}
                    aria-hidden='true'
                  />
                </span>
                <span className='lulu-feature-number'>0{index + 1}</span>
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <div className='lulu-feature-bottom'>
                <span>{feature.detail}</span>
                <ArrowUpRight size={20} aria-hidden='true' />
              </div>
            </Link>
          ))}
        </div>
        <ModelMarquee />
      </section>

      <section
        className='lulu-container lulu-next'
        aria-labelledby='lulu-next-title'
      >
        <div className='lulu-next-art' aria-hidden='true'>
          <img
            src='/lulu/hero/lulu-main.webp'
            alt=''
            width={210}
            height={210}
            loading='lazy'
          />
        </div>
        <div>
          <p className='lulu-kicker'>
            {t('FROM YOUR FIRST CALL TO YOUR NEXT BIG IDEA')}
          </p>
          <h2 id='lulu-next-title'>
            {t('Let your next idea grow with Lulu.')}
          </h2>
          <p>
            {t(
              'Choose a model, connect your tools, and leave room for what you do best.'
            )}
          </p>
        </div>
        <div className='lulu-next-actions'>
          <Link to={actionUrl} className='lulu-button lulu-button-primary'>
            {t(actionLabel)}
            <ArrowRight size={18} aria-hidden='true' />
          </Link>
          <a
            href={VARIABLE_SWITCH_URL}
            target='_blank'
            rel='noopener noreferrer'
            className='lulu-text-link'
          >
            {t('Variable Switch')}
            <ArrowUpRight size={14} aria-hidden='true' />
          </a>
        </div>
      </section>
    </main>
  )
}
