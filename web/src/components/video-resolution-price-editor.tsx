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
import { Plus, Trash2 } from 'lucide-react'
import { useId, useRef, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { VideoResolutionPriceRow } from '@/components/video-resolution-pricing'

const numericDraftRegex = /^(\d+(\.\d*)?|\.\d*)?$/

type VideoResolutionPriceEditorProps = {
  rows: VideoResolutionPriceRow[]
  onChange: Dispatch<SetStateAction<VideoResolutionPriceRow[]>>
}

export function VideoResolutionPriceEditor(
  props: VideoResolutionPriceEditorProps
) {
  const { t } = useTranslation()
  const editorId = useId()
  const nextRowId = useRef(0)

  const addResolution = () => {
    const id = `${editorId}-custom-${nextRowId.current}`
    nextRowId.current += 1
    props.onChange((current) => [
      ...current,
      { id, resolution: '', price: '', preset: false },
    ])
  }

  return (
    <FieldGroup className='gap-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <Field className='min-w-0 flex-1'>
          <FieldLabel>{t('Video resolution pricing')}</FieldLabel>
          <FieldDescription>
            {t(
              'Set the USD price for one generated second at each resolution.'
            )}
          </FieldDescription>
        </Field>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={addResolution}
        >
          <Plus data-icon='inline-start' aria-hidden='true' />
          {t('Add resolution')}
        </Button>
      </div>

      <FieldGroup className='gap-3'>
        {props.rows.map((row) => {
          const resolutionInputId = `${editorId}-${row.id}-resolution`
          const priceInputId = `${editorId}-${row.id}-price`
          return (
            <div
              key={row.id}
              className='grid min-w-0 gap-3 sm:grid-cols-[minmax(7rem,0.7fr)_minmax(12rem,1.3fr)_2rem] sm:items-end'
            >
              <Field>
                <FieldLabel htmlFor={resolutionInputId}>
                  {t('Resolution')}
                </FieldLabel>
                <Input
                  id={resolutionInputId}
                  value={row.resolution}
                  readOnly={row.preset}
                  maxLength={64}
                  placeholder='4K'
                  onChange={(event) => {
                    const resolution = event.target.value
                    props.onChange((rows) =>
                      rows.map((current) =>
                        current.id === row.id
                          ? {
                              ...current,
                              resolution,
                              price: resolution.trim() ? current.price : '',
                            }
                          : current
                      )
                    )
                  }}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={priceInputId}>
                  {t('USD per generated video second')}
                </FieldLabel>
                <InputGroup>
                  <InputGroupAddon>$</InputGroupAddon>
                  <InputGroupInput
                    id={priceInputId}
                    inputMode='decimal'
                    placeholder='0.10'
                    value={row.price}
                    onChange={(event) => {
                      const price = event.target.value
                      if (!numericDraftRegex.test(price)) return
                      props.onChange((rows) =>
                        rows.map((current) =>
                          current.id === row.id
                            ? { ...current, price }
                            : current
                        )
                      )
                    }}
                  />
                  <InputGroupAddon align='inline-end'>
                    {t('per second')}
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              {row.preset ? (
                <span className='hidden size-8 sm:block' aria-hidden='true' />
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className='text-destructive justify-self-end sm:justify-self-auto'
                          aria-label={t('Delete')}
                          onClick={() =>
                            props.onChange((rows) =>
                              rows.filter((current) => current.id !== row.id)
                            )
                          }
                        />
                      }
                    >
                      <Trash2 aria-hidden='true' />
                    </TooltipTrigger>
                    <TooltipContent>{t('Delete')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )
        })}
      </FieldGroup>
    </FieldGroup>
  )
}
