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
import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { CodeSample } from './code-sample'
import { useApiBaseUrl } from './use-api-base-url'

export function DocsOverview() {
  const { t } = useTranslation()
  const baseUrl = useApiBaseUrl()
  const quickStart = `curl ${baseUrl}/v1/images/generations \\
  -H "Authorization: Bearer $NEW_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-image-2",
    "prompt": "A clean product photograph on a white background",
    "size": "2048x2048",
    "n": 1
  }'`

  const endpoints = [
    {
      method: 'POST',
      path: '/v1/images/generations',
      purpose: t('docs.overview.endpoint.generations'),
    },
    {
      method: 'POST',
      path: '/v1/images/edits',
      purpose: t('docs.overview.endpoint.edits'),
    },
  ]

  return (
    <article className='space-y-12'>
      <header className='space-y-4 border-b pb-8'>
        <p className='text-primary text-sm font-semibold'>
          {t('docs.nav.title')}
        </p>
        <h1 className='text-3xl font-semibold sm:text-4xl'>
          {t('docs.overview.title')}
        </h1>
        <p className='text-muted-foreground max-w-3xl text-base leading-7'>
          {t('docs.overview.description')}
        </p>
      </header>

      <section className='space-y-4' id='base-url'>
        <h2 className='text-2xl font-semibold'>{t('docs.overview.baseUrl')}</h2>
        <p className='text-muted-foreground leading-7'>
          {t('docs.overview.baseUrlDescription')}
        </p>
        <div className='border-border bg-muted/30 flex min-h-12 items-center overflow-x-auto rounded-md border px-4 font-mono text-sm'>
          {baseUrl}/v1
        </div>
      </section>

      <section className='space-y-4' id='authentication'>
        <h2 className='text-2xl font-semibold'>
          {t('docs.overview.authentication')}
        </h2>
        <Alert>
          <KeyRound className='size-4' aria-hidden='true' />
          <AlertTitle>{t('docs.overview.bearerTitle')}</AlertTitle>
          <AlertDescription>
            {t('docs.overview.bearerDescription')}{' '}
            <code className='bg-muted rounded px-1 py-0.5 font-mono text-xs'>
              Authorization: Bearer YOUR_API_KEY
            </code>
          </AlertDescription>
        </Alert>
      </section>

      <section className='space-y-4' id='endpoints'>
        <h2 className='text-2xl font-semibold'>
          {t('docs.overview.endpoints')}
        </h2>
        <div className='border-border overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow className='bg-muted/40 hover:bg-muted/40'>
                <TableHead>{t('docs.overview.method')}</TableHead>
                <TableHead>{t('docs.overview.path')}</TableHead>
                <TableHead>{t('docs.overview.purpose')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.map((endpoint) => (
                <TableRow key={endpoint.path}>
                  <TableCell className='font-semibold'>
                    {endpoint.method}
                  </TableCell>
                  <TableCell className='font-mono text-xs'>
                    {endpoint.path}
                  </TableCell>
                  <TableCell className='text-muted-foreground whitespace-normal'>
                    {endpoint.purpose}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Link
          to='/docs/gpt-image-2'
          className='text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline'
        >
          {t('docs.overview.openGptImageDocs')}
          <ArrowRight className='size-4' aria-hidden='true' />
        </Link>
      </section>

      <section className='space-y-4' id='quick-start'>
        <h2 className='text-2xl font-semibold'>
          {t('docs.overview.quickStart')}
        </h2>
        <p className='text-muted-foreground leading-7'>
          {t('docs.overview.quickStartDescription')}
        </p>
        <CodeSample code={quickStart} label='cURL' />
      </section>

      <section className='space-y-4' id='compatibility'>
        <h2 className='text-2xl font-semibold'>
          {t('docs.overview.compatibility')}
        </h2>
        <Alert>
          <ShieldCheck className='size-4' aria-hidden='true' />
          <AlertTitle>{t('docs.overview.compatibilityTitle')}</AlertTitle>
          <AlertDescription>
            {t('docs.overview.compatibilityDescription')}
          </AlertDescription>
        </Alert>
      </section>

      <section className='space-y-4' id='errors'>
        <h2 className='text-2xl font-semibold'>{t('docs.overview.errors')}</h2>
        <p className='text-muted-foreground leading-7'>
          {t('docs.overview.errorsDescription')}
        </p>
        <ul className='text-muted-foreground list-disc space-y-2 pl-5 text-sm leading-6'>
          <li>
            <strong className='text-foreground'>400</strong>{' '}
            {t('docs.error.400')}
          </li>
          <li>
            <strong className='text-foreground'>401</strong>{' '}
            {t('docs.error.401')}
          </li>
          <li>
            <strong className='text-foreground'>402</strong>{' '}
            {t('docs.error.402')}
          </li>
          <li>
            <strong className='text-foreground'>429</strong>{' '}
            {t('docs.error.429')}
          </li>
          <li>
            <strong className='text-foreground'>500/502/503</strong>{' '}
            {t('docs.error.5xx')}
          </li>
        </ul>
      </section>
    </article>
  )
}
