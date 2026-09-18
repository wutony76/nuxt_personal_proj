import { reactive } from 'vue'
import { api, type ToyCatalogResponse, type ToyPogView } from '~/services/api'

type ToyPogState = {
  status: 'idle' | 'playing' | 'result'
  bet: number
  customBet: string
  hand: ToyPogView['hand']
  npcCount: number
  last: ToyPogView['last']
  playerWins: number
  npcWins: number
  reward: number
  multiplier: number
  settled: boolean
  canPlay: boolean
  revealed: boolean
  settling: boolean
  error: string | null
  balance: number
  blocked: boolean
  /** 卡住這一款的玩具 slug，來自共用彩池的 gameKey；只有 blocked 為真時才有值 */
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
 * @returns 尪仔標頁狀態。手牌在開打前已發好。
 */
export function useToyPog() {
  const state = reactive<ToyPogState>({
    status: 'idle',
    bet: 100,
    customBet: '',
    hand: [],
    npcCount: 0,
    last: null,
    playerWins: 0,
    npcWins: 0,
    reward: 0,
    multiplier: 0,
    settled: false,
    canPlay: false,
    revealed: false,
    settling: false,
    error: null,
    balance: 0,
    blocked: false,
    blockedGameKey: null,
    catalog: null,
    catalogError: null
  })

  let revealTimer: ReturnType<typeof setTimeout> | null = null

  const _handlers = {
    applyView: (view: ToyPogView, revealed: boolean) => {
      state.balance = view.balance
      state.hand = view.hand
      state.npcCount = view.npcCount
      state.last = view.last
      state.playerWins = view.playerWins
      state.npcWins = view.npcWins
      state.reward = view.reward
      state.multiplier = view.multiplier
      state.settled = view.settled
      state.canPlay = view.canPlay
      state.blocked = view.blocked
      state.blockedGameKey = view.blocked ? view.gameKey : null
      state.revealed = revealed
      state.status = view.settled || view.canPlay ? 'result' : 'idle'
    },
    revealLater: (view: ToyPogView) => {
      if (revealTimer) clearTimeout(revealTimer)
      state.status = 'playing'
      state.revealed = false
      state.last = view.last
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
        api.games.toys.pogState().catch(() => null),
        api.lottery.userInfo().catch(() => null)
      ])
      if (view) state.balance = view.balance
      else if (user) state.balance = Number(user.coin ?? 0)
      if (view?.canPlay) _handlers.applyView(view, true)
      else if (view?.blocked) {
        state.blocked = true
        state.blockedGameKey = view.gameKey
      }
    },
    start: async () => {
      if (state.settling || state.canPlay || state.blocked) return
      state.settling = true
      state.error = null
      try {
        const view = await api.games.toys.rollPog({ action: 'start', bet: state.bet })
        _handlers.applyView(view, true)
      } catch (error) {
        state.error = readError(error)
      } finally {
        state.settling = false
      }
    },
    play: async (cardId: string) => {
      if (state.settling || state.status === 'playing' || !state.canPlay) return
      state.settling = true
      state.error = null
      try {
        const view = await api.games.toys.rollPog({ action: 'play', cardId })
        state.settling = false
        _handlers.revealLater(view)
      } catch (error) {
        state.error = readError(error)
        state.settling = false
      }
    },
    chooseChip: (amount: number) => {
      if (state.canPlay || state.status === 'playing') return
      state.bet = amount
    },
    applyCustom: () => {
      if (state.canPlay || state.status === 'playing') return
      const amount = Number(state.customBet)
      if (!Number.isInteger(amount) || amount < 1) {
        state.error = '注額必須是 1 以上的整數。'
        return
      }
      state.bet = amount
      state.error = null
    },
    playAgain: () => {
      if (state.canPlay || state.status === 'playing') return
      state.hand = []
      state.last = null
      state.settled = false
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
