import { useState } from 'react'
import { Gift, Sparkles, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { drawLottery, type LotteryStatus } from '../lottery-api'

export function formatLotteryReward(reward: number): string { return Number.isInteger(reward) ? String(reward) : reward.toFixed(1) }

interface LotteryCardProps { status: LotteryStatus | null; loading?: boolean; onDrawn?: () => void }
export function LotteryCard(props: LotteryCardProps) {
  const { t } = useTranslation(); const [drawing, setDrawing] = useState(false); const [reward, setReward] = useState<number | null>(null)
  if (props.loading || !props.status) return null
  const beforeStart = props.status.before_start === true
  const handleDraw = async () => { if (beforeStart || drawing || props.status!.draw_count <= 0) return; setDrawing(true); try { const result = await drawLottery(); setReward(result.reward); toast.success(t('Lottery reward credited')); props.onDrawn?.() } catch { toast.error(t('Lottery draw failed')) } finally { setDrawing(false) } }
  return <section className='rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-background to-emerald-50 p-5 shadow-sm' aria-label={t('Lulu Grand Ceremony')}>
    <div className='flex items-start justify-between gap-4'><div className='flex items-center gap-3'><div className='rounded-full bg-amber-100 p-2 text-amber-600'><Gift className='size-5' aria-hidden='true' /></div><div><h2 className='font-semibold'>{t('Lulu Grand Ceremony')}</h2><p className='text-sm text-muted-foreground'>{t('Lulu is preparing a pomelo for you')}</p></div></div><Sparkles className='size-5 text-amber-500' aria-hidden='true' /></div>
    <div className='mt-4 flex flex-wrap items-center justify-between gap-3'><div>{beforeStart ? <p className='font-medium text-amber-700'>{t('Not started yet')}</p> : <><span className='text-2xl font-bold text-amber-600'>{props.status.draw_count}</span><span className='ml-2 text-sm text-muted-foreground'>{t('draws available')}</span>{props.status.next_threshold > 0 && <p className='mt-1 text-xs text-muted-foreground'>{t('Recharge {{amount}} more for another draw', { amount: props.status.next_threshold })}</p>}</>}</div><button type='button' onClick={handleDraw} disabled={beforeStart || drawing || props.status.draw_count <= 0} className='inline-flex items-center gap-2 rounded-md bg-amber-600 px-5 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50'>{drawing && <Loader2 className='size-4 animate-spin' aria-hidden='true' />}{beforeStart ? t('Not started yet') : t('Draw now')}</button></div>
    {reward !== null && <div role='status' className='mt-4 rounded-lg bg-amber-50 p-3 text-center text-amber-800'>{t('Lulu popped out a pomelo! You won {{reward}} quota.', { reward: formatLotteryReward(reward) })}</div>}
    <p className='mt-3 text-xs text-muted-foreground'>{t('Lulu prizes: 0.5, 1, 5 or 10 quota. No personal draw limit during the event.')}</p>
  </section>
}
