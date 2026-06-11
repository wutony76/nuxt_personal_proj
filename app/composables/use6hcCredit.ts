import { computed, reactive, ref, watch } from 'vue'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import { CREDIT_PLAY_DEFINITIONS } from '#shared/config/6hc-cd'
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
  syncedAtServerMs: 0,
  syncedAtClientMs: 0,
  nowMs: Date.now(),
  statusEndAt: 0,
  statusRemainSec: 0,
  statusRemainLabel: '00:00',
})


const orderQuery = reactive({
  userId: '',
  issue: ''
})
const jackpot = reactive({
  base: 0 as number,
  setAt: 0 as number,
  currentIssueJackpot: 0 as number,
  carryJackpot: 0 as number,
})

const livePool = computed(() => {
  const real = Number((jackpot.currentIssueJackpot + jackpot.carryJackpot).toFixed(2))
  return Number((jackpot.base + real).toFixed(2))
})

const isOpening = computed(() => String(current.runtime?.currentStatus ?? '') === STATUS_TIME.OPENING)

const openingNowMs = ref(Date.now())
let openingRafId: number | null = null

function _startOpeningTick() {
  function tick() {
    openingNowMs.value = Date.now()
    openingRafId = requestAnimationFrame(tick)
  }
  openingRafId = requestAnimationFrame(tick)
}

function _stopOpeningTick() {
  if (openingRafId !== null) cancelAnimationFrame(openingRafId)
  openingRafId = null
}

watch(isOpening, (opening) => {
  if (opening) _startOpeningTick()
  else _stopOpeningTick()
}, { immediate: true })

const openingElapsedMs = computed(() => {
  if (!isOpening.value || !time.statusEndAt) return 0
  const remainMs = Math.max(0, time.statusEndAt - openingNowMs.value)
  return Math.max(0, 40000 - remainMs)
})

const openingRevealedIndices = computed(() => {
  const e = openingElapsedMs.value
  const s = new Set<number>()
  if (e >= 9571) s.add(0)
  if (e >= 13493) s.add(1)
  if (e >= 17414) s.add(2)
  if (e >= 21786) s.add(3)
  if (e >= 27357) s.add(4)
  if (e >= 33429) s.add(6)
  if (e >= 37000) s.add(5)
  return s
})

const creditService = new Lottery6hcCreditService()

// ── Module-level server time sync helpers ────────────────────────────────

const MIN_REFRESH_DELAY_MS = 250
let tickTimer: ReturnType<typeof setInterval> | null = null
let syncTimer: ReturnType<typeof setInterval> | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let jackpotPollTimer: ReturnType<typeof setInterval> | null = null

function _clearCurrentInfoTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

function _scheduleNextCurrentInfoFetch(statusEndAt?: number) {
  _clearCurrentInfoTimer()
  if (!statusEndAt) {
    refreshTimer = setTimeout(() => fetch.refreshCurrentInfo(), 1000)
    return
  }
  const delay = Math.max(MIN_REFRESH_DELAY_MS, statusEndAt - time.nowMs + 50)
  refreshTimer = setTimeout(() => fetch.refreshCurrentInfo(), delay)
}

function _updateStatusRemain() {
  if (!time.statusEndAt) {
    time.statusRemainSec = 0
    time.statusRemainLabel = '00:00'
    return
  }
  const remainSec = Math.max(0, Math.floor((time.statusEndAt - time.nowMs) / 1000))
  time.statusRemainSec = remainSec
  const min = Math.floor(remainSec / 60)
  const sec = remainSec % 60
  time.statusRemainLabel = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function _tickServerNow() {
  if (time.syncedAtServerMs <= 0 || time.syncedAtClientMs <= 0) {
    time.nowMs = Date.now()
  } else {
    time.nowMs = time.syncedAtServerMs + (Date.now() - time.syncedAtClientMs)
  }
  _updateStatusRemain()
}

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
    fetch.startJackpotPolling()
  },

  currentInfo: async () => {
    const result = await creditService.fetchCurrentInfo()
    current.runtime = result
    if (result.statusEndAt > 0) {
      time.statusEndAt = result.statusEndAt
      _tickServerNow()
    }
    if (result.jackpot?.jackpotBase && result.jackpot.jackpotBase > 0) {
      jackpot.base = result.jackpot.jackpotBase
      if (result.jackpot.jackpotBaseSetAt > 0) jackpot.setAt = result.jackpot.jackpotBaseSetAt
      // 初始化：polling 尚未跑過時從 currentInfo 補上，避免初始畫面顯示 0
      if (!jackpotPollTimer) {
        if (result.jackpot.currentIssueJackpot != null) jackpot.currentIssueJackpot = Number(result.jackpot.currentIssueJackpot)
        if (result.jackpot.carryJackpot != null) jackpot.carryJackpot = Number(result.jackpot.carryJackpot)
      }
    }

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
      const nextStatus = String(data?.currentStatus ?? '')
      if (prevStatus.includes('開獎中') && !nextStatus.includes('開獎中')) {
        // fetch.roadPlays()
      }
      _scheduleNextCurrentInfoFetch(data?.statusEndAt)
    } catch {
      _scheduleNextCurrentInfoFetch()
    }
  },
  startJackpotPolling: () => {
    if (jackpotPollTimer) return
    jackpotPollTimer = setInterval(async () => {
      try {
        const result = await creditService.fetchJackpot()
        if (result.jackpotBase > 0) jackpot.base = result.jackpotBase
        if (result.jackpotBaseSetAt > 0) jackpot.setAt = result.jackpotBaseSetAt
        if (result.currentIssueJackpot != null) jackpot.currentIssueJackpot = Number(result.currentIssueJackpot)
        if (result.carryJackpot != null) jackpot.carryJackpot = Number(result.carryJackpot)
      } catch { /* silent */ }
    }, 5000)
  },
  stopJackpotPolling: () => {
    if (!jackpotPollTimer) return
    clearInterval(jackpotPollTimer)
    jackpotPollTimer = null
  },
}

const init = {
  syncServerTime: async () => {
    try {
      const result = await creditService.fetchServerTime()
      time.syncedAtServerMs = result.serverTime
      time.syncedAtClientMs = Date.now()
      _tickServerNow()
    } catch { }
  },
  startServerTimeSync: async () => {
    if (tickTimer) return
    await init.syncServerTime()
    tickTimer = setInterval(_tickServerNow, 1000)
    syncTimer = setInterval(init.syncServerTime, 15000)
  },
  stopServerTimeSync: () => {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null }
    if (syncTimer) { clearInterval(syncTimer); syncTimer = null }
    _clearCurrentInfoTimer()
    fetch.stopJackpotPolling()
  },
  run: () => { }
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
    livePool,
    jackpot,
    isOpening,
    openingRevealedIndices,
  }
}
