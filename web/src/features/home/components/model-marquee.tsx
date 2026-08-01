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

import { HOME_MARQUEE_SEQUENCES } from './model-marquee-data'

interface ModelSequenceProps {
  hidden: boolean
  models: readonly string[]
}

function ModelSequence(props: ModelSequenceProps) {
  return (
    <div
      className='flex min-w-[100vw] shrink-0 items-center justify-around'
      aria-hidden={props.hidden || undefined}
    >
      {props.models.map((model) => (
        <div key={model} className='flex shrink-0 items-center'>
          <span className='mx-5 text-sm font-medium text-white/85 sm:mx-8 sm:text-base'>
            {model}
          </span>
          <span className='size-1 rounded-full bg-cyan-200 shadow-[0_0_10px_rgba(165,243,252,0.9)]' />
        </div>
      ))}
    </div>
  )
}

export function ModelMarquee() {
  const { t } = useTranslation()

  return (
    <section
      className='home-marquee-surface relative border-y border-white/15 py-4 backdrop-blur-xl lg:-mt-4'
      aria-label={t('Available model providers')}
    >
      <div className='home-marquee-mask overflow-hidden'>
        <div className='home-marquee-track flex w-max'>
          {HOME_MARQUEE_SEQUENCES.map((models, index) => (
            <ModelSequence
              key={index === 0 ? 'primary' : 'continuation'}
              models={models}
              hidden={index > 0}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
