import { $fetch } from 'ofetch'
import { LOTTERY } from '~/config/constants'

export type AuthUser = {
  id: string | number
  name: string
  email: string
}

export type LotteryGame = {
  id: number
  key: string
  name: string
  category: '6hc' | 'a6' | 'bg'
  minBet: number
  maxBet: number
  defaultOdds: number
  playTypes: string[]
}

export type BetRecord = {
  id: string
  gameId: number
  gameName: string
  betType: string
  number: string
  amount: number
  odds: number
  potentialPayout: number
  createdAt: string
  status?: 'accepted'
}

export type LotteryState = {
  balance: number
  recentBets: BetRecord[]
  totalBetAmount: number
  currentIssueBetAmount: number
  coin?: number
  currentBets?: number
  totalBets?: number
  analysis?: string
}

export type Lottery6hcRoadPlay = {
  id?: number
  num?: number | string
  label?: string
  countIssue?: number
  countShow?: number
  selected?: boolean
  colorY?: boolean
}

export type Lottery6hcOfCurrent = {
  issueCurrent: string
  issueLatest: string
  currentStatus: string
  countdown: string
  statusEndAt: number
  openCode: string[]
  openCodePlay: Array<{
    num?: string | number
    label?: string | number
    countIssue?: number
    countShow?: number
    animal?: string
  }>
}

export type TaiwanLotteryResult = {
  gameCode: number
  gameName: string
  en: string
  period?: string
  lotNumber: Array<string | number>
}

export type LotteryBetPayload = {
  lottery?: { id?: number; key?: string }
  groups?: Array<Record<string, unknown>>
  amount: number
  gameId?: number
  betType?: string
  number?: string
}

export type LotteryBetOrder = {
  order_id: string
  issue: string
  user_id: string
  bet_time: number
  coin: number
  bet_code: string[]
  status: 'pending' | 'success' | 'settled'
}

export type LotteryBetResponse = {
  message: string
  coin: number
  orderId: string
  orders: LotteryBetOrder[]
}

export const api = {
  system: {
    servTime: () => $fetch<{ serverTime: number }>('/api/servTime')
  },
  auth: {
    me: () => $fetch<{ user: AuthUser }>('/api/me'),
    login: (payload: { email: string; password: string }) =>
      $fetch<{ user: AuthUser }>('/api/login', {
        method: 'POST',
        body: payload
      }),
    logout: () =>
      $fetch('/api/logout', {
        method: 'POST'
      })
  },
  lottery: {
    currentInfo: (lotteryId: string | number) => {
      const normalizedLotteryId = Number(lotteryId)
      switch (normalizedLotteryId) {
        case LOTTERY['LHC-OF'].id:
          return $fetch<Lottery6hcOfCurrent>('/api/lottery/6hc-of/current')
        default:
          return null
      }
    },
    current6hcOf: () => $fetch<Lottery6hcOfCurrent>('/api/lottery/6hc-of/current'),
    road6hcOf: () => $fetch<{ plays: Lottery6hcRoadPlay[] }>('/api/lottery/6hc-of/road'),
    games: () => $fetch<{ games: LotteryGame[] }>('/api/lottery/games'),
    userInfo: () => $fetch<LotteryState>('/api/lottery/userInfo'),
    bet: (payload: LotteryBetPayload) =>
      $fetch<LotteryBetResponse>('/api/lottery/bet', {
        method: 'POST',
        body: payload
      })
  },
  taiwanLottery: {
    lastNumber: () =>
      $fetch<{ updatedAt: string; results: TaiwanLotteryResult[] }>('/api/taiwan-lottery/last-number')
  }
}
