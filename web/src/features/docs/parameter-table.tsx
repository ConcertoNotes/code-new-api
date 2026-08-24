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
import { useTranslation } from 'react-i18next'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export type ParameterRow = {
  name: string
  type: string
  required: boolean
  description: string
}

export function ParameterTable(props: { rows: ParameterRow[] }) {
  const { t } = useTranslation()

  return (
    <div className='border-border overflow-hidden rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow className='bg-muted/40 hover:bg-muted/40'>
            <TableHead>{t('docs.parameter.name')}</TableHead>
            <TableHead>{t('docs.parameter.type')}</TableHead>
            <TableHead>{t('docs.parameter.required')}</TableHead>
            <TableHead className='min-w-80'>
              {t('docs.parameter.description')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.name}>
              <TableCell>
                <code className='bg-muted rounded px-1.5 py-0.5 font-mono text-xs'>
                  {row.name}
                </code>
              </TableCell>
              <TableCell className='text-muted-foreground font-mono text-xs'>
                {row.type}
              </TableCell>
              <TableCell>
                {row.required ? t('docs.common.yes') : t('docs.common.no')}
              </TableCell>
              <TableCell className='text-muted-foreground whitespace-normal'>
                {row.description}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
