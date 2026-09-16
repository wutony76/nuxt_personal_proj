import { reactive } from 'vue'
import { api, type ToyCatalogResponse, type ToyGummyColor, type ToyGummyView } from '~/services/api'

type ToyGummyState = {
  status: 'idle' | 'playing' | 'result'
  bet: number
  customBet: string
  color: ToyGummyColor | null
  history: ToyGummyColor[]
  revealed: boolean
  pot: number
  reward: number
  multiplier: number
  streak: number
  correct: boolean | null
  settling: boolean
  claimed: boolean
  canGuess: boolean
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
 * @returns 橡皮糖頁狀態。顏色只來自伺服器。
 */
export function useToyGummy() {
  const state = reactive<ToyGummyState>({
    status: 'idle',
    bet: 100,
    customBet: '',
    color: null,
    history: [],
    revealed: false,
    pot: 0,
    reward: 0,
    multiplier: 0,
    streak: 0,
    correct: null,
    settling: false,
    claimed: false,
    canGuess: false,
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
    applyView: (view: ToyGummyView, revealed: boolean) => {
      state.balance = view.balance
      state.pot = view.unclaimed
      state.reward = view.reward
      state.claimed = view.claimed
      state.canGuess = view.canGuess
      state.canClaim = view.canClaim
      state.multiplier = view.multiplier
      state.streak = view.streak
      state.correct = view.correct
      state.color = view.color
      state.history = view.history
      state.blockedGameKey = view.gameKey && view.gameKey !== 'gummy' ? view.gameKey : null
      state.finished = view.gameKey !== 'gummy' && (view.claimed || view.correct === false)
      state.revealed = revealed
      state.status = view.gameKey === 'gummy' || state.finished ? 'result' : 'idle'
    },
    revealLater: (view: ToyGummyView) => {
      if (revealTimer) clearTimeout(revealTimer)
      state.status = 'playing'
      state.revealed = false
      state.color = view.color
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
        api.games.toys.gummyState().catch(() => null),
        api.lottery.userInfo().catch(() => null)
      ])
      if (user) state.balance = user.balance
      if (view?.gameKey === 'gummy') _handlers.applyView(view, true)
      else if (view?.gameKey) state.blockedGameKey = view.gameKey
    },
    start: async () => {
      if (state.settling || state.status === 'playing' || state.canGuess) return
      state.settling = true
      state.error = null
      try {
        const view = await api.games.toys.rollGummy({ action: 'start', bet: state.bet })
        _handlers.applyView(view, true)
      } catch (error) {
        state.error = readError(error)
      } finally {
        state.settling = false
      }
    },
    guess: async (guess: ToyGummyColor) => {
      if (state.settling || state.status === 'playing' || !state.canGuess) return
      state.settling = true
      state.error = null
      try {
        const view = await api.games.toys.rollGummy({ action: 'guess', guess })
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
        const view = await api.games.toys.rollGummy({ action: 'claim' })
        _handlers.applyView(view, true)
      } catch (error) {
        state.error = readError(error)
      } finally {
        state.settling = false
      }
    },
    chooseChip: (amount: number) => {
      if (state.canGuess || state.pot > 0) return
      state.bet = amount
    },
    applyCustom: () => {
      if (state.canGuess || state.pot > 0) return
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
      state.color = null
      state.history = []
      state.revealed = false
      state.correct = null
      state.reward = 0
      state.streak = 0
      state.finished = false
      state.canGuess = false
      state.status = 'idle'
      state.blockedGameKey = null
    }
  }

  const stopReveal = () => {
    if (revealTimer) clearTimeout(revealTimer)
  }

  return { state, actions, stopReveal }
}
