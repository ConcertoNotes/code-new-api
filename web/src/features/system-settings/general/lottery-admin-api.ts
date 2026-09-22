import { api } from '@/lib/api'

export interface LotteryAdminPrize {
  id: number
  amount: number
  stock: number
  initial_stock: number
}

export interface LotteryAdminWinner {
  user_id: number
  username: string
  draws: number
  total_amount: number
  total_quota: number
  last_draw_at: number
}

export interface LotteryAdminOverview {
  prizes: LotteryAdminPrize[]
  total_recharge: number
  budget_remaining: number
  issued_amount: number
  issued_quota: number
  draw_count: number
  winner_count: number
  winners: LotteryAdminWinner[]
}

export interface LotteryAdminDraw {
  id: number
  user_id: number
  username: string
  amount: number
  quota: number
  user_factor: number
  budget_factor: number
  stock_snapshot: string
  created_at: number
}

export interface LotteryAdminDrawsPage {
  items: LotteryAdminDraw[]
  total: number
  page: number
  page_size: number
}

interface ApiEnvelope<T> {
  success: boolean
  message?: string
  data: T
}

export async function getLotteryAdminOverview(): Promise<LotteryAdminOverview> {
  const res = await api.get<ApiEnvelope<LotteryAdminOverview>>(
    '/api/user/lottery/admin/overview'
  )
  if (!res.data.success) throw new Error(res.data.message ?? 'request failed')
  return res.data.data
}

export async function getLotteryAdminDraws(params: {
  page: number
  pageSize: number
  keyword: string
}): Promise<LotteryAdminDrawsPage> {
  const res = await api.get<ApiEnvelope<LotteryAdminDrawsPage>>(
    '/api/user/lottery/admin/draws',
    {
      params: {
        p: params.page,
        page_size: params.pageSize,
        keyword: params.keyword || undefined,
      },
    }
  )
  if (!res.data.success) throw new Error(res.data.message ?? 'request failed')
  return res.data.data
}
