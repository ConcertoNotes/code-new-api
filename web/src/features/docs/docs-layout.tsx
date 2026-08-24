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
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { BookOpen, Image } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { cn } from '@/lib/utils'

const docsLinks = [
  { href: '/docs', labelKey: 'docs.nav.overview', icon: BookOpen },
  { href: '/docs/gpt-image-2', labelKey: 'docs.nav.gptImage2', icon: Image },
] as const

export function DocsLayout() {
  const { t } = useTranslation()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <PublicLayout showMainContainer={false}>
      <div className='mx-auto grid min-h-svh max-w-7xl pt-16 lg:grid-cols-[15rem_minmax(0,1fr)]'>
        <aside className='border-border bg-background/95 sticky top-16 z-20 border-b backdrop-blur lg:h-[calc(100svh-4rem)] lg:border-r lg:border-b-0'>
          <nav
            aria-label={t('docs.nav.ariaLabel')}
            className='flex gap-1 overflow-x-auto px-4 py-3 lg:flex-col lg:px-5 lg:py-8'
          >
            <p className='text-muted-foreground mb-2 hidden px-2 text-xs font-semibold lg:block'>
              {t('docs.nav.title')}
            </p>
            {docsLinks.map((item) => {
              const Icon = item.icon
              const isActive =
                pathname === item.href || pathname === `${item.href}/`
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  <Icon className='size-4' aria-hidden='true' />
                  {t(item.labelKey)}
                </Link>
              )
            })}
          </nav>
        </aside>

        <main className='min-w-0 px-5 py-10 sm:px-8 lg:px-12 lg:py-12'>
          <div className='mx-auto max-w-4xl'>
            <Outlet />
          </div>
        </main>
      </div>
    </PublicLayout>
  )
}
