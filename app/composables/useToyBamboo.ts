import { reactive } from 'vue'
import { api, type ToyBambooTarget, type ToyBambooView, type ToyCatalogResponse } from '~/services/api'

type ToyBambooState = {
  status: 'idle' | 'playing' | 'result'
  bet: number
  customBet: string
  target: ToyBambooTarget
  height: number | null
  shownHeight: number
  hit: boolean | null
  multiplier: number
  reward: number
  settling: boolean
  revealed: boolean
  error: string | null
  balance: number
  blocked: boolean
  catalog: ToyCatalogResponse | null
  catalogError: string | null
}

/**
 * @param error 未知錯誤
 * @returns 可顯示的訊息
 */
function readError(error: unknown): string {
  const data = error as { data?: { message?: string }; message?: string }
  return data?.data?.message || data?.message || '這一步沒有完成，請再試一次。'
}

/**
 * @returns 竹蜻蜓頁狀態。高度只來自伺服器。
 */
export function useToyBamboo() {
  const state = reactive<ToyBambooState>({
    status: 'idle',
    bet: 100,
    customBet: '',
    target: 'm30',
    height: null,
    shownHeight: 0,
    hit: null,
    multiplier: 0,
    reward: 0,
    settling: false,
    revealed: false,
    error: null,
    balance: 0,
    blocked: false,
    catalog: null,
    catalogError: null
  })

  let revealTimer: ReturnType<typeof setTimeout> | null = null

  const _handlers = {
    applyView: (view: ToyBambooView, revealed: boolean) => {
      state.balance = view.balance
      state.height = view.height
      state.hit = view.hit
      state.multiplier = view.multiplier
      state.reward = view.reward
      state.blocked = view.blocked
      state.revealed = revealed
      state.status = revealed && view.height != null ? 'result' : 'idle'
    },
    revealLater: (view: ToyBambooView) => {
      if (revealTimer) clearTimeout(revealTimer)
      state.status = 'playing'
      state.revealed = false
      state.hit = null
      state.shownHeight = view.height ?? 0
      const wait = state.catalog?.flipMs ?? 600
      revealTimer = setTimeout(() => {
        _handlers.applyView(view, true)
        revealTimer = null
      }, wait)
    }
  }

  const actions = {
    load: async () => {
      state.catalogError = null
      const catalog = await api.games.toys.catalog().catch((error: unknown) => {
        state.catalogError = readError(error)
        return null
      })
      if (catalog) {
        state.catalog = catalog
        const chip = catalog.betChips[2] ?? catalog.betChips[0]
        if (chip) state.bet = chip
      }
      const [view, user] = await Promise.all([
        api.games.toys.bambooState().catch(() => null),
        api.lottery.userInfo().catch(() => null)
      ])
      if (user) state.balance = user.balance
      if (view?.blocked) state.blocked = true
    },
    launch: async () => {
      if (state.settling || state.status === 'playing' || state.blocked) return
      state.settling = true
      state.error = null
      try {
        const view = await api.games.toys.rollBamboo({ bet: state.bet, target: state.target })
        state.settling = false
        _handlers.revealLater(view)
      } catch (error) {
        state.error = readError(error)
        state.settling = false
      }
    },
    chooseTarget: (target: ToyBambooTarget) => {
      if (state.status === 'playing') return
      state.target = target
    },
    chooseChip: (amount: number) => {
      if (state.status === 'playing') return
      state.bet = amount
    },
    applyCustom: () => {
      if (state.status === 'playing') return
      const amount = Number(state.customBet)
      if (!Number.isInteger(amount) || amount < 1) {
        state.error = '注額必須是 1 以上的整數。'
        return
      }
      state.bet = amount
      state.error = null
    },
    playAgain: () => {
      if (state.status === 'playing') return
      state.height = null
      state.shownHeight = 0
      state.hit = null
      state.reward = 0
      state.revealed = false
      state.status = 'idle'
    }
  }

  const stopReveal = () => {
    if (revealTimer) clearTimeout(revealTimer)
  }

  return { state, actions, stopReveal }
}
