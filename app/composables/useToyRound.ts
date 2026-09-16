import { reactive } from 'vue'
import { api, type ToyCatalogResponse, type ToyLuckyDrawView } from '~/services/api'

export type ToyRoundStatus = 'idle' | 'playing' | 'result'

type ToyRoundState = {
  status: ToyRoundStatus
  bet: number
  customBet: string
  pot: number
  reward: number
  result: ToyLuckyDrawView['result']
  settling: boolean
  claimed: boolean
  revealed: boolean
  picking: boolean
  error: string | null
  balance: number
  canContinue: boolean
  canClaim: boolean
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
 * @returns 抽抽樂頁的局狀態。未領金額以伺服器彩池為準。
 */
export function useToyRound() {
  const state = reactive<ToyRoundState>({
    status: 'idle',
    bet: 100,
    customBet: '',
    pot: 0,
    reward: 0,
    result: null,
    settling: false,
    claimed: false,
    revealed: false,
    picking: false,
    error: null,
    balance: 0,
    canContinue: false,
    canClaim: false,
    blockedGameKey: null,
    catalog: null,
    catalogError: null
  })

  let revealTimer: ReturnType<typeof setTimeout> | null = null

  const _handlers = {
    applyView: (view: ToyLuckyDrawView, revealed: boolean) => {
      state.balance = view.balance
      state.pot = view.unclaimed
      state.reward = view.reward
      state.claimed = view.claimed
      state.canContinue = view.canContinue
      state.canClaim = view.canClaim
      state.blockedGameKey = view.gameKey && view.gameKey !== 'lucky-draw' ? view.gameKey : null
      if (view.result) state.result = view.result
      state.revealed = revealed
      state.status = view.unclaimed > 0 || view.result || view.claimed ? 'result' : 'idle'
      if (view.claimed) state.status = 'result'
    },
    revealLater: () => {
      if (revealTimer) clearTimeout(revealTimer)
      state.status = 'playing'
      state.revealed = false
      const wait = state.catalog?.flipMs ?? 600
      revealTimer = setTimeout(() => {
        state.revealed = true
        state.status = 'result'
        revealTimer = null
      }, wait)
    }
  }

  const actions = {
    load: async () => {
      state.catalogError = null
      try {
        const [catalog, pool, info] = await Promise.all([
          api.games.toys.catalog(),
          api.games.toys.pool(),
          api.lottery.userInfo()
        ])
        state.catalog = catalog
        state.balance = Number(info.coin ?? pool.balance)
        _handlers.applyView({ ...pool, balance: state.balance }, Boolean(pool.unclaimed))
        if (!catalog.betChips.includes(state.bet)) state.bet = catalog.betChips[0] ?? 100
      } catch (error) {
        state.catalogError = readError(error)
      }
    },
    start: async (cellIndex: number) => {
      if (state.settling || state.status === 'playing') return
      if (state.pot > 0) return
      state.settling = true
      state.error = null
      state.reward = 0
      state.claimed = false
      try {
        const view = await api.games.toys.rollLuckyDraw({ action: 'start', bet: state.bet, cellIndex })
        _handlers.applyView(view, false)
        _handlers.revealLater()
      } catch (error) {
        state.error = readError(error)
      } finally {
        state.settling = false
      }
    },
    continueDraw: async (cellIndex: number) => {
      if (state.settling || state.status === 'playing' || !state.picking) return
      state.settling = true
      state.error = null
      state.picking = false
      try {
        const view = await api.games.toys.rollLuckyDraw({ action: 'continue', cellIndex })
        _handlers.applyView(view, false)
        _handlers.revealLater()
      } catch (error) {
        state.error = readError(error)
        state.picking = true
      } finally {
        state.settling = false
      }
    },
    claim: async () => {
      if (state.settling || state.claimed || state.pot <= 0) return
      state.settling = true
      state.error = null
      try {
        const view = await api.games.toys.rollLuckyDraw({ action: 'claim' })
        if (revealTimer) clearTimeout(revealTimer)
        _handlers.applyView(view, true)
        state.status = 'result'
      } catch (error) {
        state.error = readError(error)
      } finally {
        state.settling = false
      }
    },
    chooseChip: (amount: number) => {
      if (state.settling || state.status === 'playing' || state.pot > 0) return
      state.bet = amount
      state.customBet = ''
      state.error = null
    },
    applyCustom: () => {
      if (state.settling || state.status === 'playing' || state.pot > 0) return
      const amount = Number(state.customBet)
      if (!Number.isInteger(amount) || amount < 1) {
        state.error = '自訂注額必須是 1 以上的整數。'
        return
      }
      if (amount > state.balance) {
        state.error = '注額不能超過目前 F 幣。'
        return
      }
      state.bet = amount
      state.error = null
    },
    armContinue: () => {
      if (!state.canContinue || state.settling) return
      state.picking = true
      state.status = 'idle'
      state.revealed = false
      state.result = null
      state.error = null
    },
    playAgain: () => {
      if (state.pot > 0 || state.settling) return
      if (revealTimer) clearTimeout(revealTimer)
      state.status = 'idle'
      state.result = null
      state.reward = 0
      state.claimed = false
      state.revealed = false
      state.picking = false
      state.error = null
    }
  }

  return { state, actions, stopReveal: () => { if (revealTimer) clearTimeout(revealTimer) } }
}
