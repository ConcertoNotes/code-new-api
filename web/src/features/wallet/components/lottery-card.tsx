import { isAxiosError } from 'axios'
import dayjs from 'dayjs'
import { Gift, Sparkles, Loader2, History } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { formatLotteryReward, lotteryErrorMessageKey } from '../lib/lottery'
import {
  drawLottery,
  getLotteryRecords,
  type LotteryDrawErrorCode,
  type LotteryRecord,
  type LotteryStatus,
} from '../lottery-api'

interface LotteryCardProps {
  status: LotteryStatus | null
  loading?: boolean
  onDrawn?: () => void
}

export function LotteryCard(props: LotteryCardProps) {
  const { t } = useTranslation()
  const [drawing, setDrawing] = useState(false)
  const [reward, setReward] = useState<number | null>(null)
  const [rewardIsPreview, setRewardIsPreview] = useState(false)
  const [records, setRecords] = useState<LotteryRecord[]>([])

  const active =
    props.status?.enabled && !props.status.before_start && !props.status.ended
  const loadRecords = useCallback(() => {
    getLotteryRecords()
      .then(setRecords)
      .catch(() => setRecords([]))
  }, [])

  useEffect(() => {
    if (active) loadRecords()
  }, [active, loadRecords])

  if (
    props.loading ||
    !props.status ||
    !props.status.enabled ||
    props.status.ended
  ) {
    return null
  }
  const status = props.status
  // 管理员没有真实次数时走服务端预览（不入账），其他人必须有次数且奖池可发
  const previewMode = status.preview_available === true
  const canDraw =
    active &&
    !drawing &&
    (previewMode || (status.draw_count > 0 && !status.refilling))

  const handleDraw = async () => {
    if (!canDraw) return
    setDrawing(true)
    try {
      const result = await drawLottery()
      setReward(result.reward)
      setRewardIsPreview(result.preview === true)
      if (result.preview) {
        toast.info(t('Preview only, nothing was credited'))
      } else {
        toast.success(t('Lottery reward credited'))
      }
      loadRecords()
      props.onDrawn?.()
    } catch (error) {
      const code = isAxiosError<{ code?: LotteryDrawErrorCode }>(error)
        ? error.response?.data?.code
        : undefined
      toast.error(t(lotteryErrorMessageKey(code)))
      props.onDrawn?.()
    } finally {
      setDrawing(false)
    }
  }

  let buttonLabel = t('Draw now')
  if (previewMode) buttonLabel = t('Preview draw')
  else if (status.before_start) buttonLabel = t('Not started yet')
  else if (status.refilling) buttonLabel = t('Refilling')

  return (
    <section
      className='via-background rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-emerald-50 p-5 shadow-sm'
      aria-label={t('Lulu Grand Ceremony')}
    >
      <div className='flex items-start justify-between gap-4'>
        <div className='flex items-center gap-3'>
          <div className='rounded-full bg-amber-100 p-2 text-amber-600'>
            <Gift className='size-5' aria-hidden='true' />
          </div>
          <div>
            <h2 className='font-semibold'>{t('Lulu Grand Ceremony')}</h2>
            <p className='text-muted-foreground text-sm'>
              {t('Lulu is preparing a pomelo for you')}
            </p>
          </div>
        </div>
        <div className='text-muted-foreground text-right text-xs'>
          <Sparkles
            className='ml-auto size-5 text-amber-500'
            aria-hidden='true'
          />
          <p className='mt-1'>
            {t('Ends {{date}}', {
              date: dayjs(status.activity_end).format('MM-DD HH:mm'),
            })}
          </p>
          {status.admin_preview && (
            <p className='mt-1 font-medium text-emerald-700'>
              {t('Admin preview: time limit bypassed')}
            </p>
          )}
        </div>
      </div>

      <div className='mt-4 flex flex-wrap items-end justify-between gap-3'>
        <div>
          {status.before_start ? (
            <p className='font-medium text-amber-700'>
              {t('Starts {{date}}', {
                date: dayjs(status.activity_start).format('MM-DD HH:mm'),
              })}
            </p>
          ) : (
            <>
              <span className='text-2xl font-bold text-amber-600'>
                {status.draw_count}
              </span>
              <span className='text-muted-foreground ml-2 text-sm'>
                {t('draws available')}
              </span>
              <p className='text-muted-foreground mt-1 text-xs'>
                {t('Recharged {{recharge}} · Won {{reward}} quota', {
                  recharge: formatLotteryReward(status.total_recharge),
                  reward: formatLotteryReward(status.total_reward),
                })}
              </p>
              {status.next_threshold > 0 && (
                <p className='text-muted-foreground mt-1 text-xs'>
                  {t('Recharge {{amount}} more for another draw', {
                    amount: formatLotteryReward(status.next_threshold),
                  })}
                </p>
              )}
            </>
          )}
        </div>
        <button
          type='button'
          onClick={handleDraw}
          disabled={!canDraw}
          className='inline-flex items-center gap-2 rounded-md bg-amber-600 px-5 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50'
        >
          {drawing && (
            <Loader2 className='size-4 animate-spin' aria-hidden='true' />
          )}
          {buttonLabel}
        </button>
      </div>

      {status.refilling && !status.before_start && !previewMode && (
        <p
          role='status'
          className='mt-3 rounded-md bg-amber-100/70 px-3 py-2 text-xs text-amber-800'
        >
          {t(
            'The prize pool is refilling as recharges come in. Your draws are kept and can be used later.'
          )}
        </p>
      )}

      {reward !== null && (
        <div
          role='status'
          className='mt-4 rounded-lg bg-amber-50 p-3 text-center text-amber-800'
        >
          <span
            className='inline-block text-2xl motion-safe:animate-bounce'
            aria-hidden='true'
          >
            🍊
          </span>
          <p className='mt-1 font-medium'>
            {t('Lulu popped out a pomelo! You won {{reward}} quota.', {
              reward: formatLotteryReward(reward),
            })}
          </p>
          {rewardIsPreview && (
            <p className='mt-1 text-xs text-emerald-700'>
              {t('Admin preview result: no quota credited, no stock used')}
            </p>
          )}
        </div>
      )}

      {records.length > 0 && (
        <div className='mt-4'>
          <h3 className='text-muted-foreground flex items-center gap-1 text-xs font-medium'>
            <History className='size-3.5' aria-hidden='true' />
            {t('My recent draws')}
          </h3>
          <ul className='mt-1 divide-y text-xs'>
            {records.slice(0, 5).map((record) => (
              <li key={record.id} className='flex justify-between py-1'>
                <span>
                  {t('{{amount}} quota', {
                    amount: formatLotteryReward(record.reward),
                  })}
                </span>
                <time
                  dateTime={dayjs.unix(record.created_at).toISOString()}
                  className='text-muted-foreground'
                >
                  {dayjs.unix(record.created_at).format('MM-DD HH:mm')}
                </time>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className='text-muted-foreground mt-3 text-xs'>
        {t(
          'Every {{threshold}} recharged during the event earns one draw. Every draw wins quota, credited instantly. No personal draw limit.',
          { threshold: formatLotteryReward(status.threshold) }
        )}
      </p>
    </section>
  )
}
