import { reactive } from 'vue'
import { api, type ToyCatalogResponse, type ToyWhistleChoice, type ToyWhistleView } from '~/services/api'

type ToyWhistleState = {
  status: 'idle' | 'playing' | 'result'
  bet: number
  customBet: string
  choice: ToyWhistleChoice
  player: ToyWhistleChoice | null
  npc: ToyWhistleChoice | null
  outcome: ToyWhistleView['outcome']
  multiplier: number
  reward: number
  history: ToyWhistleChoice[]
  countdown: number | null
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
 * @returns 哨子糖頁狀態。倒數不會重抽。
 */
export function useToyWhistle() {
  const state = reactive<ToyWhistleState>({
    status: 'idle',
    bet: 100,
    customBet: '',
    choice: 'short',
    player: null,
    npc: null,
    outcome: null,
    multiplier: 0,
    reward: 0,
    history: [],
    countdown: null,
    revealed: false,
    settling: false,
    error: null,
    balance: 0,
    blocked: false,
    catalog: null,
    catalogError: null
  })

  let countdownTimer: ReturnType<typeof setInterval> | null = null

  const _handlers = {
    applyView: (view: ToyWhistleView) => {
      state.balance = view.balance
      state.player = view.player
      state.npc = view.npc
      state.outcome = view.outcome
      state.multiplier = view.multiplier
      state.reward = view.reward
      state.history = view.history
      state.blocked = view.blocked
      state.revealed = true
      state.countdown = null
      state.status = view.npc ? 'result' : 'idle'
    },
    countdown: (view: ToyWhistleView) => {
      if (countdownTimer) clearInterval(countdownTimer)
      state.status = 'playing'
      state.revealed = false
      state.countdown = 3
      state.player = view.player
      countdownTimer = setInterval(() => {
        if (state.countdown == null) return
        if (state.countdown <= 1) {
          if (countdownTimer) clearInterval(countdownTimer)
          _handlers.applyView(view)
          return
        }
        state.countdown -= 1
      }, 700)
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
        api.games.toys.whistleState().catch(() => null),
        api.lottery.userInfo().catch(() => null)
      ])
      if (user) state.balance = user.balance
      if (view) state.history = view.history
      if (view?.blocked) state.blocked = true
    },
    play: async () => {
      if (state.settling || state.status === 'playing' || state.blocked) return
      state.settling = true
      state.error = null
      try {
        const view = await api.games.toys.rollWhistle({ bet: state.bet, choice: state.choice })
        state.settling = false
        _handlers.countdown(view)
      } catch (error) {
        state.error = readError(error)
        state.settling = false
      }
    },
    choose: (choice: ToyWhistleChoice) => {
      if (state.status === 'playing') return
      state.choice = choice
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
      state.outcome = null
      state.reward = 0
      state.revealed = false
      state.status = 'idle'
    }
  }

  const stopReveal = () => {
    if (countdownTimer) clearInterval(countdownTimer)
  }

  return { state, actions, stopReveal }
}
