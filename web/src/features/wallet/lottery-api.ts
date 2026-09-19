import { api } from '@/lib/api'

export interface LotteryStatus {
  enabled: boolean
  before_start: boolean
  ended: boolean
  admin_preview?: boolean
  activity_start: string
  activity_end: string
  threshold: number
  draw_count: number
  draws_used?: number
  total_recharge: number
  total_reward: number
  pool_remaining?: Record<string, number>
  pool_initial?: Record<string, number>
  budget_remaining?: number
  preview_available?: boolean
  next_threshold: number
  refilling: boolean
}

export interface LotteryDrawResult {
  reward: number
  quota: number
  record_id: number
  preview?: boolean
  message?: string
}

export type LotteryDrawErrorCode =
  | 'inactive'
  | 'no_draws'
  | 'pool_refilling'
  | 'pool_exhausted'
  | 'retry'
  | 'failed'

export interface LotteryRecord {
  id: number
  reward: number
  quota: number
  created_at: number
}

export async function getLotteryStatus(): Promise<LotteryStatus> {
  const res = await api.get<LotteryStatus>('/api/user/lottery/status')
  return res.data
}

export async function drawLottery(): Promise<LotteryDrawResult> {
  const res = await api.post<LotteryDrawResult>('/api/user/lottery/draw')
  return res.data
}

export async function getLotteryRecords(): Promise<LotteryRecord[]> {
  const res = await api.get<{ items?: LotteryRecord[] }>(
    '/api/user/lottery/records'
  )
  return res.data?.items ?? []
}
