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
type StepHeadingProps = {
  id: string
  step: string
  title: string
}

/** 工作台分区标题：左侧序号徽标 + 标题 */
export function StepHeading(props: StepHeadingProps) {
  return (
    <div className='flex items-center gap-2'>
      <span className='bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-[10px]'>
        {props.step}
      </span>
      <h3 id={props.id} className='text-sm font-semibold'>
        {props.title}
      </h3>
    </div>
  )
}
