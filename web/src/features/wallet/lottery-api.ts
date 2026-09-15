import { api } from '@/lib/api'

export interface LotteryStatus { enabled: boolean; before_start?: boolean; draw_count: number; total_recharge: number; total_reward: number; pool_remaining: Record<string, number>; next_threshold: number; activity_end: string }
export interface LotteryDrawResult { reward: number; draw_count: number; message?: string }
export interface LotteryRecord { id: number; reward: number; created_at: string }

export async function getLotteryStatus(): Promise<LotteryStatus> { const res = await api.get('/api/user/lottery/status'); return res.data }
export async function drawLottery(): Promise<LotteryDrawResult> { const res = await api.post('/api/user/lottery/draw'); return res.data }
export async function getLotteryRecords(): Promise<LotteryRecord[]> { const res = await api.get('/api/user/lottery/records'); return res.data?.items ?? res.data ?? [] }
