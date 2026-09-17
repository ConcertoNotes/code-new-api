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
import { VChart } from '@visactor/react-vchart'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PanelWrapper } from '@/features/dashboard/components/ui/panel-wrapper'
import { formatQuotaWithCurrency } from '@/lib/currency'
import dayjs from '@/lib/dayjs'
import { useChartTheme } from '@/lib/use-chart-theme'
import { VCHART_OPTION } from '@/lib/vchart'

import { aggregateProfitByChannel } from '../lib/profit'
import type { ChannelProfitRow, ChannelProfitTrendPoint } from '../types'

const CHANNEL_CHART_LIMIT = 12

function formatAmount(quota: number): string {
  return formatQuotaWithCurrency(quota, { abbreviate: false })
}

function formatAxisAmount(quota: number): string {
  return formatQuotaWithCurrency(quota, { abbreviate: true })
}

const FALLBACK_CHART_COLORS = {
  light: { textColor: 'rgba(15, 23, 42, 0.58)', gridColor: 'rgba(15, 23, 42, 0.12)' },
  dark: {
    textColor: 'rgba(255, 255, 255, 0.68)',
    gridColor: 'rgba(255, 255, 255, 0.12)',
  },
} as const

/**
 * 图表文字/网格颜色跟随站点主题变量（自定义主题可能在 light 模式下使用深色背景，
 * 因此不能只按 light/dark 写死颜色），读取失败时回退到明暗默认值。
 */
function useChartColors() {
  const { resolvedTheme, themeReady } = useChartTheme()
  const [colors, setColors] = useState<{ textColor: string; gridColor: string }>(
    () => FALLBACK_CHART_COLORS.light
  )

  useEffect(() => {
    const fallback = FALLBACK_CHART_COLORS[resolvedTheme === 'dark' ? 'dark' : 'light']
    const probe = document.createElement('span')
    probe.className = 'text-muted-foreground border-border'
    probe.style.position = 'absolute'
    probe.style.visibility = 'hidden'
    document.body.appendChild(probe)
    const computed = getComputedStyle(probe)
    const textColor = computed.color || fallback.textColor
    const gridColor = computed.borderColor || fallback.gridColor
    probe.remove()
    setColors({ textColor, gridColor })
  }, [resolvedTheme])

  return { resolvedTheme, themeReady, ...colors }
}

interface ProfitChannelChartProps {
  rows: ChannelProfitRow[]
  loading?: boolean
}

/** 各渠道利润对比柱状图（多分组按渠道合并，取前 12 名） */
export function ProfitChannelChart(props: ProfitChannelChartProps) {
  const { t } = useTranslation()
  const { resolvedTheme, themeReady, textColor, gridColor } = useChartColors()

  const values = useMemo(
    () =>
      aggregateProfitByChannel(props.rows)
        .slice(0, CHANNEL_CHART_LIMIT)
        .map((item) => ({
          channel: `${item.channel_name} #${item.channel_id}`,
          profit: Number(item.profit_quota.toFixed(2)),
        })),
    [props.rows]
  )

  const spec = useMemo(() => {
    if (values.length === 0) return null
    return {
      type: 'bar' as const,
      data: [{ id: 'channel-profit', values }],
      // 顶部留白，避免柱顶的金额标签被容器裁掉
      padding: { top: 24, right: 12, bottom: 8, left: 8 },
      xField: 'channel',
      yField: 'profit',
      bar: {
        style: {
          cornerRadius: [4, 4, 0, 0],
          fill: (datum: Record<string, unknown>) =>
            Number(datum?.profit) < 0 ? '#ef4444' : '#3b82f6',
        },
      },
      label: {
        visible: true,
        position: 'top',
        style: { fill: textColor, fontSize: 10 },
        formatMethod: (val: number | string) => formatAxisAmount(Number(val)),
      },
      axes: [
        {
          orient: 'bottom',
          label: {
            style: { fill: textColor, fontSize: 10 },
            autoHide: true,
            autoLimit: true,
          },
          tick: { visible: false },
        },
        {
          orient: 'left',
          label: {
            formatMethod: (val: number | string) =>
              formatAxisAmount(Number(val)),
            style: { fill: textColor, fontSize: 10 },
          },
          grid: {
            visible: true,
            style: { lineDash: [3, 3], stroke: gridColor },
          },
        },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: t('Realtime Profit'),
              value: (datum: Record<string, unknown>) =>
                formatAmount(Number(datum?.profit) || 0),
            },
          ],
        },
        dimension: { visible: false },
      },
      animationAppear: { duration: 400 },
    }
  }, [gridColor, t, textColor, values])

  return (
    <PanelWrapper
      title={t('Profit by Channel')}
      description={t('Top {{count}} channels by realtime profit', {
        count: CHANNEL_CHART_LIMIT,
      })}
      loading={props.loading}
      empty={values.length === 0}
      height='h-64'
    >
      <div className='h-64'>
        {themeReady && spec ? (
          <VChart
            key={`channel-profit-${resolvedTheme}`}
            spec={{
              ...spec,
              theme: resolvedTheme === 'dark' ? 'dark' : 'light',
              background: 'transparent',
            }}
            option={VCHART_OPTION}
          />
        ) : null}
      </div>
    </PanelWrapper>
  )
}

interface ProfitTrendChartProps {
  trend: ChannelProfitTrendPoint[]
  loading?: boolean
}

/** 每日收入 / 成本 / 利润趋势折线图 */
export function ProfitTrendChart(props: ProfitTrendChartProps) {
  const { t } = useTranslation()
  const { resolvedTheme, themeReady, textColor, gridColor } = useChartColors()

  const values = useMemo(() => {
    const series = [
      { key: 'quota', label: t('Revenue') },
      { key: 'cost_quota', label: t('Upstream Cost') },
      { key: 'profit_quota', label: t('Realtime Profit') },
    ] as const
    return props.trend.flatMap((point) => {
      const date = dayjs(point.date * 1000).format('MM-DD')
      return series.map((item) => ({
        date,
        type: item.label,
        value: Number(point[item.key].toFixed(2)),
      }))
    })
  }, [props.trend, t])

  const spec = useMemo(() => {
    if (values.length === 0) return null
    return {
      type: 'line' as const,
      data: [{ id: 'profit-trend', values }],
      xField: 'date',
      yField: 'value',
      seriesField: 'type',
      point: { style: { size: 6 } },
      line: { style: { lineWidth: 2, curveType: 'monotone' } },
      color: ['#3b82f6', '#f97316', '#22c55e'],
      legends: {
        visible: true,
        orient: 'top',
        position: 'end',
        item: { label: { style: { fill: textColor, fontSize: 11 } } },
      },
      axes: [
        {
          orient: 'bottom',
          label: {
            style: { fill: textColor, fontSize: 10 },
            autoHide: true,
          },
          tick: { visible: false },
        },
        {
          orient: 'left',
          label: {
            formatMethod: (val: number | string) =>
              formatAxisAmount(Number(val)),
            style: { fill: textColor, fontSize: 10 },
          },
          grid: {
            visible: true,
            style: { lineDash: [3, 3], stroke: gridColor },
          },
        },
      ],
      tooltip: {
        dimension: {
          content: [
            {
              key: (datum: Record<string, unknown>) =>
                String(datum?.type ?? ''),
              value: (datum: Record<string, unknown>) =>
                formatAmount(Number(datum?.value) || 0),
            },
          ],
        },
        mark: { visible: false },
      },
      animationAppear: { duration: 400 },
    }
  }, [gridColor, textColor, values])

  return (
    <PanelWrapper
      title={t('Profit Trend')}
      description={t('Daily revenue, upstream cost and profit')}
      loading={props.loading}
      empty={values.length === 0}
      height='h-64'
    >
      <div className='h-64'>
        {themeReady && spec ? (
          <VChart
            key={`profit-trend-${resolvedTheme}`}
            spec={{
              ...spec,
              theme: resolvedTheme === 'dark' ? 'dark' : 'light',
              background: 'transparent',
            }}
            option={VCHART_OPTION}
          />
        ) : null}
      </div>
    </PanelWrapper>
  )
}
