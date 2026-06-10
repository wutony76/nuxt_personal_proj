import { computed, reactive } from 'vue'
import { LOTTERY } from '~/config/constants'
import { CREDIT_PLAY_DEFINITIONS } from '~/config/bg/6hc-cd'
import { api, type Lottery6hcCurrent } from '~/services/api'
import { handle as utHandle } from '~/utils/common'
import { Lottery6hcCreditService } from '~/services/lottery6hcCreditService'


// ── Types ──────────────────────────────────────────────────────────────────
type CurrentDetailRow = {
  id: string
  time: string
  bets: string[]
  danBets?: string[]
  tuoBets?: string[]
  coin: number
  betCount: number
  status: Status
}

interface PlayOption {
  id: string
  label: string
  num?: number
}

interface CreditPlayDefinition {
  key: string
  name: string
  source: string
  description: string
  playTypeNames: string[]
  groupNames: string[]
  playTypeOptions: Record<string, PlayOption[]>
}

interface CreditBetPayload {
  playKey: string
  typeName: string
  codes: string[]
  amount: number
}

// ── Module-level singletons (shared across components) ─────────────────────

const state = reactive({
  selectedPlayKey: 'tema' as string,
  selectedTypeName: '' as string,
  activePlay: null as CreditPlayDefinition | null,
  selectedCodes: [] as string[],
  amount: 10 as number,
  customCodeInput: '' as string,
  fetchStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',
  submitStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',
  message: '' as string,
  errorMessage: '' as string,
  lastOrderId: '' as string,
  lastOrders: [] as unknown[],
})

const current = reactive({
  detail: [],
  runtime: null as Lottery6hcCurrent | null,
  orderCache: {
    isLoading: false,
    isSuccess: false,
    errorMessage: ''
  }
})

const wallet = reactive({
  userName: '-' as string,
  userId: '-' as string,
  creditLimit: 0 as number,
  balanceLimit: 0 as number,
  panType: '盤口A' as string,
})

const time = reactive({
  countdownSeconds: 300 as number,
  countdownLabel: '00:05:00' as string,
  countdownTimer: null as ReturnType<typeof setInterval> | null,
})


const orderQuery = reactive({
  userId: '',
  issue: ''
})
const jackpot = reactive({
  base: 0 as number,
  setAt: 0 as number,
})
const creditService = new Lottery6hcCreditService()

const fetch = {
  initPageData: async (userId?: string | number | null) => {
    const _userId = utHandle.normalizeUserId(userId)
    orderQuery.userId = _userId
    // await fetch.orderDetailFromCache(normalizedUserId)
    await Promise.all([
      fetch.refreshCurrentInfo(),
      // fetch.roadPlays(),
      // fetch.walletState(),
      // fetch.betMeta(),
    ])
    // fetch.startJackpotPolling()
  },

  currentInfo: async () => {
    const result = await creditService.fetchCurrentInfo()
    current.runtime = result
    if (result.jackpot?.jackpotBase && result.jackpot.jackpotBase > 0) {
      jackpot.base = result.jackpot.jackpotBase
      if (result.jackpot.jackpotBaseSetAt > 0) jackpot.setAt = result.jackpot.jackpotBaseSetAt
    }
    // init.setStatusEndAt(result.statusEndAt)

    const _userId = orderQuery.userId
    const issue = String(result?.issueCurrent ?? '')
    if (_userId && issue) {
      orderQuery.issue = issue
      // handle.startOrderDetailSync(_userId, issue)
    }
    return result
  },
  refreshCurrentInfo: async () => {
    try {
      const prevStatus = String(current.runtime?.currentStatus ?? '')
      const data = await fetch.currentInfo()
      console.log('---data', data)
      const nextStatus = String(data?.currentStatus ?? '')
      if (prevStatus.includes('開獎中') && !nextStatus.includes('開獎中')) {
        // fetch.roadPlays()
      }
      // handle.scheduleNextCurrentInfoFetch(data?.statusEndAt)
    } catch {
      // Keep page usable even when runtime data is temporarily unavailable.
      // handle.scheduleNextCurrentInfoFetch()
    }
  },

}

const init = {
  run: () => {
  }
}
init.run()

export const use6hcCredit = () => {
  const auth = useAuth()

  const playList = computed(() => CREDIT_PLAY_DEFINITIONS as CreditPlayDefinition[])

  const availableCodes = computed(() => {
    if (!state.activePlay || !state.selectedTypeName) return []
    return _handlers.getTypeOptions(state.activePlay, state.selectedTypeName)
  })

  const canSubmit = computed(() => {
    const amount = Number(state.amount)
    return state.submitStatus !== 'loading' && amount > 0 && state.selectedCodes.length > 0
  })

  const click = {
    handleSelectPlay: async (playKey: string) => {
      await _actions.fetchPlayByKey(playKey)
    },
    handleSelectType: async (typeName: string) => {
      await _actions.fetchTypeByName(typeName)
    },
    handleToggleCode: (option: PlayOption | string) => {
      _actions.toggleCode(option)
    },
    handleQuickAmount: (amount: number) => {
      _actions.setAmount(amount)
    },
    handleAppendCustomCode: () => {
      _actions.appendCustomCode()
    },
    handleResetSelection: () => {
      _actions.resetSelection()
    },
    handleSubmitBet: async () => {
      await _actions.submitBet()
    },
  }

  const _actions = {
    // ── Countdown ──────────────────────────────────────────────
    formatCountdown: (total: number): string => {
      const safeTotal = Number.isFinite(total) && total > 0 ? total : 0
      const hour = String(Math.floor(safeTotal / 3600)).padStart(2, '0')
      const minute = String(Math.floor((safeTotal % 3600) / 60)).padStart(2, '0')
      const second = String(safeTotal % 60).padStart(2, '0')
      return `${hour}:${minute}:${second}`
    },
    syncCountdown: () => {
      time.countdownSeconds = Math.max(0, time.countdownSeconds - 1)
      time.countdownLabel = _actions.formatCountdown(time.countdownSeconds)
      if (time.countdownSeconds === 0) {
        time.countdownSeconds = 300
        time.countdownLabel = _actions.formatCountdown(time.countdownSeconds)
      }
    },
    startCountdown: () => {
      _actions.stopCountdown()
      time.countdownLabel = _actions.formatCountdown(time.countdownSeconds)
      time.countdownTimer = setInterval(_actions.syncCountdown, 1000)
    },
    stopCountdown: () => {
      if (time.countdownTimer) {
        clearInterval(time.countdownTimer)
        time.countdownTimer = null
      }
    },
    // ── User ───────────────────────────────────────────────────
    initUserInfo: async () => {
      await auth.init()
      wallet.userName = String(auth.user.value?.name || 'Guest')
      wallet.userId = String(auth.user.value?.id || '-')
      try {
        const userInfo = await api.lottery.userInfo()
        const coin = Number((userInfo as any)?.coin ?? 0)
        wallet.creditLimit = coin
        wallet.balanceLimit = coin
      } catch {
        wallet.creditLimit = 784500000
        wallet.balanceLimit = 784500000
      }
    },
    // ── Amount ─────────────────────────────────────────────────
    setAmount: (amount: number) => {
      const normalized = Number(amount)
      if (!Number.isFinite(normalized) || normalized <= 0) return
      state.amount = normalized
    },
    // ── Code selection ──────────────────────────────────────────
    appendCustomCode: () => {
      const input = String(state.customCodeInput || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      if (input.length === 0) return
      const set = new Set(state.selectedCodes)
      input.forEach((code) => set.add(code))
      state.selectedCodes = Array.from(set)
      state.customCodeInput = ''
    },
    toggleCode: (option: PlayOption | string) => {
      const next = String((option as PlayOption)?.label ?? option)
      if (state.submitStatus === 'loading') return
      if (state.selectedCodes.includes(next)) {
        state.selectedCodes = state.selectedCodes.filter((item) => item !== next)
        return
      }
      state.selectedCodes = [...state.selectedCodes, next]
    },
    resetSelection: () => {
      if (state.submitStatus === 'loading') return
      state.selectedCodes = []
      state.customCodeInput = ''
      state.message = ''
      state.errorMessage = ''
    },
    // ── Play ────────────────────────────────────────────────────
    fetchTypeByName: async (typeName: string) => {
      if (state.fetchStatus === 'loading' || !state.activePlay) return
      if (!state.activePlay.playTypeNames.includes(typeName) || state.selectedTypeName === typeName) return
      state.fetchStatus = 'loading'
      state.errorMessage = ''
      try {
        state.selectedTypeName = typeName
        state.selectedCodes = []
        state.fetchStatus = 'success'
      } catch (error) {
        state.fetchStatus = 'error'
        state.errorMessage = error instanceof Error ? error.message : '子玩法切換失敗'
      }
    },
    fetchPlayByKey: async (playKey: string) => {
      if (state.fetchStatus === 'loading' || state.selectedPlayKey === playKey) return
      state.fetchStatus = 'loading'
      state.errorMessage = ''
      try {
        const nextPlay = _handlers.resolvePlayDefinition(playKey)
        if (!nextPlay) throw new Error('找不到指定玩法')
        state.selectedPlayKey = playKey
        state.activePlay = nextPlay
        state.selectedTypeName = nextPlay.playTypeNames[0] || ''
        state.selectedCodes = []
        state.fetchStatus = 'success'
      } catch (error) {
        state.fetchStatus = 'error'
        state.errorMessage = error instanceof Error ? error.message : '玩法載入失敗'
      }
    },
    initPlay: async () => {
      state.fetchStatus = 'loading'
      state.errorMessage = ''
      try {
        const initialPlay = _handlers.resolvePlayDefinition(state.selectedPlayKey)
        if (!initialPlay) throw new Error('初始化玩法失敗')
        state.activePlay = initialPlay
        state.selectedTypeName = initialPlay.playTypeNames[0] || ''
        state.selectedCodes = []
        state.fetchStatus = 'success'
      } catch (error) {
        state.fetchStatus = 'error'
        state.errorMessage = error instanceof Error ? error.message : '初始化失敗'
      }
    },
    // ── Bet ─────────────────────────────────────────────────────
    submitBet: async () => {
      if (!canSubmit.value || !state.activePlay) return
      state.submitStatus = 'loading'
      state.errorMessage = ''
      state.message = ''
      try {
        const payload: CreditBetPayload = {
          playKey: state.activePlay.key,
          typeName: state.selectedTypeName,
          codes: [...state.selectedCodes],
          amount: Number(state.amount),
        }
        const groups = _handlers.toApiGroups(payload)
        const result = await api.lottery.bet({
          lottery: { id: LOTTERY['LHC-CD'].id, key: LOTTERY['LHC-CD'].key },
          amount: Number(state.amount),
          groups,
        }) as any
        state.lastOrderId = String(result?.orderId || '')
        state.lastOrders = Array.isArray(result?.orders) ? result.orders : []
        state.submitStatus = 'success'
        state.message = `下注成功，共 ${state.selectedCodes.length} 筆，單號 ${state.lastOrderId || '-'}`
      } catch (error) {
        state.submitStatus = 'error'
        state.errorMessage = _handlers.getErrorMessage(error)
      }
    },
  }

  const _handlers = {
    resolvePlayDefinition: (playKey: string): CreditPlayDefinition | null => {
      return (CREDIT_PLAY_DEFINITIONS as CreditPlayDefinition[]).find((item) => item.key === playKey) || null
    },
    toApiGroups: (payload: CreditBetPayload) => {
      const optionMap = new Map(
        _handlers.getTypeOptions(state.activePlay!, payload.typeName)
          .map((option) => [String(option.label), option])
      )
      return [
        {
          playKey: payload.playKey,
          playTypeName: payload.typeName,
          playList: payload.codes.map((code, index) => {
            const option = optionMap.get(String(code))
            const num = Number(code)
            return {
              playId: option?.id || `${payload.playKey}-${payload.typeName}-${index + 1}`,
              label: code,
              num: Number.isFinite(num) && num > 0 ? num : undefined,
              amount: payload.amount,
            }
          }),
        },
      ]
    },
    getTypeOptions: (play: CreditPlayDefinition | null, typeName: string): PlayOption[] => {
      if (!play || !typeName) return []
      const options = (play.playTypeOptions || {})[typeName]
      return Array.isArray(options) ? options : []
    },
    getErrorMessage: (error: unknown): string => {
      const err = error as any
      if (err?.data?.statusMessage) return String(err.data.statusMessage)
      if (error instanceof Error) return error.message
      return '下注失敗，請稍後重試'
    },
  }

  return {
    state,
    current,
    wallet,
    playList,
    availableCodes,
    canSubmit,
    click,
    actions: _actions,
    init,
    fetch,


    //
    time,
    livePool: false,
    isOpening: false,
    openingRevealedIndices: [],
  }
}
