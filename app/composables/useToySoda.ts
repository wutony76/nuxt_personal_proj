import { reactive } from 'vue'
import { api, type ToyCatalogResponse, type ToySodaView } from '~/services/api'

type ToySodaState = {
  status: 'idle' | 'playing' | 'result'
  bet: number
  customBet: string
  step: number
  prize: number
  busted: boolean | null
  revealed: boolean
  pot: number
  reward: number
  settling: boolean
  claimed: boolean
  canContinue: boolean
  canClaim: boolean
  finished: boolean
  error: string | null
  balance: number
  blockedGameKey: string | null
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
 * @returns 汽水笛頁的局狀態。成敗在翻面前已由伺服器決定。
 */
export function useToySoda() {
  const state = reactive<ToySodaState>({
    status: 'idle',
    bet: 100,
    customBet: '',
    step: 0,
    prize: 0,
    busted: null,
    revealed: false,
    pot: 0,
    reward: 0,
    settling: false,
    claimed: false,
    canContinue: false,
    canClaim: false,
    finished: false,
    error: null,
    balance: 0,
    blockedGameKey: null,
    catalog: null,
    catalogError: null
  })

  let revealTimer: ReturnType<typeof setTimeout> | null = null

  const _handlers = {
    applyView: (view: ToySodaView, revealed: boolean) => {
      state.balance = view.balance
      state.pot = view.unclaimed
      state.reward = view.reward
      state.claimed = view.claimed
      state.canContinue = view.canContinue
      state.canClaim = view.canClaim
      state.step = view.step
      state.prize = view.prize
      state.busted = view.busted
      state.blockedGameKey = view.gameKey && view.gameKey !== 'soda-whistle' ? view.gameKey : null
      state.finished = view.gameKey !== 'soda-whistle' && (view.claimed || view.busted === true)
      state.revealed = revealed
      state.status = view.gameKey === 'soda-whistle' || state.finished ? 'result' : 'idle'
    },
    revealLater: (view: ToySodaView) => {
      if (revealTimer) clearTimeout(revealTimer)
      state.status = 'playing'
      state.revealed = false
      state.busted = null
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
        api.games.toys.sodaState().catch(() => null),
        api.lottery.userInfo().catch(() => null)
      ])
      if (view) state.balance = view.balance
      else if (user) state.balance = Number(user.coin ?? 0)
      if (view?.gameKey === 'soda-whistle') _handlers.applyView(view, true)
      else if (view?.gameKey) state.blockedGameKey = view.gameKey
    },
    start: async () => {
      if (state.settling || state.status === 'playing' || state.pot > 0 || state.canClaim) return
      state.settling = true
      state.error = null
      try {
        const view = await api.games.toys.rollSoda({ action: 'start', bet: state.bet })
        state.settling = false
        _handlers.revealLater(view)
      } catch (error) {
        state.error = readError(error)
        state.settling = false
      }
    },
    blow: async () => {
      if (state.settling || state.status === 'playing' || !state.canContinue) return
      state.settling = true
      state.error = null
      try {
        const view = await api.games.toys.rollSoda({ action: 'continue' })
        state.settling = false
        _handlers.revealLater(view)
      } catch (error) {
        state.error = readError(error)
        state.settling = false
      }
    },
    claim: async () => {
      if (state.settling || !state.canClaim) return
      state.settling = true
      state.error = null
      try {
        const view = await api.games.toys.rollSoda({ action: 'claim' })
        _handlers.applyView(view, true)
      } catch (error) {
        state.error = readError(error)
      } finally {
        state.settling = false
      }
    },
    chooseChip: (amount: number) => {
      if (state.pot > 0 || state.status === 'playing') return
      state.bet = amount
    },
    applyCustom: () => {
      if (state.pot > 0 || state.status === 'playing') return
      const amount = Number(state.customBet)
      if (!Number.isInteger(amount) || amount < 1) {
        state.error = '注額必須是 1 以上的整數。'
        return
      }
      state.bet = amount
      state.error = null
    },
    playAgain: () => {
      if (state.pot > 0 || state.canClaim) return
      state.step = 0
      state.prize = 0
      state.busted = null
      state.revealed = false
      state.reward = 0
      state.finished = false
      state.status = 'idle'
      state.blockedGameKey = null
    }
  }

  const stopReveal = () => {
    if (revealTimer) clearTimeout(revealTimer)
  }

  return { state, actions, stopReveal }
}
