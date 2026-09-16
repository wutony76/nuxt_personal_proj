import { reactive } from 'vue'
import { api, type ToyBigPigView, type ToyCatalogResponse } from '~/services/api'

type ToyBigPigState = {
  status: 'idle' | 'playing' | 'result'
  bet: number
  customBet: string
  player: [number, number] | null
  npc: [number, number] | null
  kind: ToyBigPigView['kind']
  multiplier: number
  reward: number
  revealed: boolean
  settling: boolean
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
 * @returns 大豬公頁狀態。點數在動畫前已決定。
 */
export function useToyBigPig() {
  const state = reactive<ToyBigPigState>({
    status: 'idle',
    bet: 100,
    customBet: '',
    player: null,
    npc: null,
    kind: null,
    multiplier: 0,
    reward: 0,
    revealed: false,
    settling: false,
    error: null,
    balance: 0,
    blocked: false,
    catalog: null,
    catalogError: null
  })

  let revealTimer: ReturnType<typeof setTimeout> | null = null

  const _handlers = {
    applyView: (view: ToyBigPigView, revealed: boolean) => {
      state.balance = view.balance
      state.player = view.player
      state.npc = view.npc
      state.kind = view.kind
      state.multiplier = view.multiplier
      state.reward = view.reward
      state.blocked = view.blocked
      state.revealed = revealed
      state.status = revealed && view.player ? 'result' : 'idle'
    },
    revealLater: (view: ToyBigPigView) => {
      if (revealTimer) clearTimeout(revealTimer)
      state.status = 'playing'
      state.revealed = false
      state.player = view.player
      state.npc = view.npc
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
        api.games.toys.bigPigState().catch(() => null),
        api.lottery.userInfo().catch(() => null)
      ])
      if (user) state.balance = user.balance
      if (view?.blocked) state.blocked = true
    },
    roll: async () => {
      if (state.settling || state.status === 'playing' || state.blocked) return
      state.settling = true
      state.error = null
      try {
        const view = await api.games.toys.rollBigPig({ bet: state.bet })
        state.settling = false
        _handlers.revealLater(view)
      } catch (error) {
        state.error = readError(error)
        state.settling = false
      }
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
      state.player = null
      state.npc = null
      state.kind = null
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
