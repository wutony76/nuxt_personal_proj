import { computed, reactive, watch } from 'vue'
import { LOTTERY, STATUS_TIME, STATUS_ERR_CODE } from '~/config/constants'
import {
  api,
  type BingoCurrent,
  type BingoUserBetHistory,
  type LotteryUserBalanceChange,
  type LotteryClaimableIssue,
  type BingoOpenCodeHistoryItem
} from '~/services/api'
import {
  BINGO_BET_UNIT,
  BINGO_MAX_SLOTS,
  BINGO_NUMBER_MIN,
  BINGO_NUMBER_MAX,
  BINGO_STAR_MIN,
  BINGO_STAR_MAX,
  bingoValidateStarNumbers,
  type BingoSlot,
  type BingoBetType,
  type BingoBigSmallPick,
  type BingoOddEvenPick
} from '#shared/config/bingo'

/**
 * 賓果賓果（BINGO）前端狀態
 *
 * ── 與 P3/P4「單一玩法」最大的差異 ──────────────────────────────────
 *   一次送單可以混合 4 種投注類型（基本玩法／超級獎號／猜大小／猜單雙），每種類型各自
 *   獨立計價（皆 25 coin／注，超級獎號為獨立加購，不併入基本玩法金額），見 shared/config/bingo.ts。
 *   本 composable 用單一 `slots` 陣列存放所有已加入的注單（不分類型混合排列），送單時整包送出。
 *
 * ⚠️ state 是 module 級單例（比照 useP3 / useP4 等既有玩法）。
 */

export type BingoDraftSlot = { id: string } & BingoSlot

let _slotSeq = 0
function _nextSlotId(): string {
  _slotSeq += 1
  return `bingo-slot-${_slotSeq}`
}

// ── Module-level singletons ────────────────────────────────────────────────
const state = reactive({
  fetchStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',
  submitStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',
  message: '' as string,
  errorMessage: '' as string,
  lastOrderId: '' as string,
  /** 目前投注面板顯示的分頁（不影響已加入 slots 的內容） */
  activeTab: 'star' as BingoBetType
})

const current = reactive({
  runtime: null as BingoCurrent | null
})

/** 基本玩法草稿：目前選定的星數與已選號碼（尚未加入 slots 前的暫存） */
const starDraft = reactive({
  star: 5,
  numbers: [] as number[]
})
/** 超級獎號草稿 */
const superDraft = reactive({
  number: null as number | null
})

const slots = reactive<BingoDraftSlot[]>([])

const wallet = reactive({ userName: '-', userId: '-', coin: 0, currentBets: 0, totalBets: 0 })

const time = reactive({
  syncedAtServerMs: 0,
  syncedAtClientMs: 0,
  nowMs: Date.now()
})

const userRecord = reactive({
  isLoading: false,
  isSubmittingClaim: false,
  errorMessage: '',
  balanceChanges: [] as LotteryUserBalanceChange[],
  betHistory: [] as BingoUserBetHistory[],
  claimableIssues: [] as LotteryClaimableIssue[]
})

const openCodeHistory = reactive({
  isLoading: false,
  errorMessage: '',
  list: [] as BingoOpenCodeHistoryItem[]
})

// ── Computed ───────────────────────────────────────────────────────────────
const lotteryMeta = computed(() => LOTTERY.BINGO)
const totalAmount = computed(() => slots.length * BINGO_BET_UNIT)
const canAddSlot = computed(() => slots.length < BINGO_MAX_SLOTS)
const isOpen = computed(() => String(current.runtime?.currentStatus ?? '') === STATUS_TIME.OPEN)
const isPendingSettlement = computed(() => String(current.runtime?.currentStatus ?? '') === STATUS_TIME.PENDING_SETTLEMENT)
const canSubmit = computed(() => isOpen.value && state.submitStatus !== 'loading' && slots.length > 0)
const countdownLabel = computed(() => current.runtime?.countdown ?? '')
const starDraftReady = computed(() => starDraft.numbers.length === starDraft.star)

// ── Helpers ────────────────────────────────────────────────────────────────
function _tickServerNow() {
  time.nowMs = time.syncedAtServerMs <= 0 || time.syncedAtClientMs <= 0
    ? Date.now()
    : time.syncedAtServerMs + (Date.now() - time.syncedAtClientMs)
}

function _randomStarNumbers(star: number): number[] {
  const pool = Array.from({ length: BINGO_NUMBER_MAX - BINGO_NUMBER_MIN + 1 }, (_, i) => BINGO_NUMBER_MIN + i)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j] as number, pool[i] as number]
  }
  return pool.slice(0, star).sort((a, b) => a - b)
}

if (import.meta.client) {
  const { user: authUser } = useAuth()
  watch(authUser, (value) => {
    if (!value) return
    wallet.userName = String(value.name || 'Guest')
    wallet.userId = String(value.id || '-')
  }, { immediate: true })
}

let clockTimer: ReturnType<typeof setInterval> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

// ── Actions ────────────────────────────────────────────────────────────────
const _actions = {
  setActiveTab: (tab: BingoBetType) => { state.activeTab = tab },

  // ── 基本玩法（星數選號）草稿 ──
  setStar: (star: number) => {
    if (!Number.isInteger(star) || star < BINGO_STAR_MIN || star > BINGO_STAR_MAX) return
    starDraft.star = star
    starDraft.numbers = []
  },
  toggleStarNumber: (num: number) => {
    const idx = starDraft.numbers.indexOf(num)
    if (idx >= 0) {
      starDraft.numbers.splice(idx, 1)
      return
    }
    if (starDraft.numbers.length >= starDraft.star) return
    starDraft.numbers.push(num)
    starDraft.numbers.sort((a, b) => a - b)
  },
  quickPickStar: () => {
    starDraft.numbers = _randomStarNumbers(starDraft.star)
  },
  clearStarDraft: () => { starDraft.numbers = [] },
  addStarSlot: () => {
    const numbers = bingoValidateStarNumbers(starDraft.star, starDraft.numbers)
    if (!numbers || slots.length >= BINGO_MAX_SLOTS) return
    slots.push({ id: _nextSlotId(), betType: 'star', star: starDraft.star, numbers })
    starDraft.numbers = []
  },

  // ── 超級獎號草稿 ──
  setSuperNumber: (num: number) => {
    if (num < BINGO_NUMBER_MIN || num > BINGO_NUMBER_MAX) return
    superDraft.number = superDraft.number === num ? null : num
  },
  addSuperSlot: () => {
    if (superDraft.number === null || slots.length >= BINGO_MAX_SLOTS) return
    slots.push({ id: _nextSlotId(), betType: 'super', number: superDraft.number })
    superDraft.number = null
  },

  // ── 猜大小／猜單雙：選定即直接加入 slots（沒有草稿選填過程） ──
  addBigSmallSlot: (pick: BingoBigSmallPick) => {
    if (slots.length >= BINGO_MAX_SLOTS) return
    slots.push({ id: _nextSlotId(), betType: 'bigSmall', pick })
  },
  addOddEvenSlot: (pick: BingoOddEvenPick) => {
    if (slots.length >= BINGO_MAX_SLOTS) return
    slots.push({ id: _nextSlotId(), betType: 'oddEven', pick })
  },

  removeSlot: (id: string) => {
    const idx = slots.findIndex((s) => s.id === id)
    if (idx >= 0) slots.splice(idx, 1)
  },
  clearAll: () => { slots.splice(0, slots.length) }
}

// ── Fetch ──────────────────────────────────────────────────────────────────
const fetch = {
  refreshCurrentInfo: async () => {
    try {
      const result = await api.lottery.currentBingo()
      if (!result) return
      current.runtime = result
      time.syncedAtServerMs = Date.now()
      time.syncedAtClientMs = Date.now()
    } catch (error) {
      state.errorMessage = error instanceof Error ? error.message : '取得當期資訊失敗'
    }
  },
  userInfo: async () => {
    const { user } = useAuth()
    wallet.userName = String(user.value?.name || 'Guest')
    wallet.userId = String(user.value?.id || '-')
    try {
      const res = await api.lottery.userInfo(lotteryMeta.value.key)
      wallet.coin = Number(res?.coin ?? 0)
      wallet.currentBets = Number(res?.currentBets ?? 0)
      wallet.totalBets = Number(res?.totalBets ?? 0)
    } catch { /* 錢包取不到不阻斷畫面 */ }
  },
  userRecordAll: async () => {
    userRecord.isLoading = true
    userRecord.errorMessage = ''
    try {
      const res = await api.lottery.userRecordBingo()
      userRecord.balanceChanges = res?.balanceChanges ?? []
      userRecord.betHistory = res?.betHistory ?? []
      userRecord.claimableIssues = res?.claimableIssues ?? []
    } catch (error) {
      userRecord.errorMessage = error instanceof Error ? error.message : '取得紀錄失敗'
    } finally {
      userRecord.isLoading = false
    }
  },
  openCodeHistoryAll: async () => {
    openCodeHistory.isLoading = true
    try {
      const res = await api.lottery.openCodeHistoryBingo()
      openCodeHistory.list = Array.isArray(res?.history) ? res.history : []
    } catch (error) {
      openCodeHistory.errorMessage = error instanceof Error ? error.message : '取得開獎歷史失敗'
    } finally {
      openCodeHistory.isLoading = false
    }
  },
  claimOneIssue: async () => {
    userRecord.isSubmittingClaim = true
    try {
      const res = await api.lottery.claimOneIssueBingo()
      if (res?.ok) {
        wallet.coin = Number(res.coin ?? wallet.coin)
        await fetch.userRecordAll()
      }
      return res
    } finally {
      userRecord.isSubmittingClaim = false
    }
  },
  /** 送單：把目前已加入的所有組別（不分類型）一次送出 */
  submit: async () => {
    if (state.submitStatus === 'loading') return { ok: false, message: '投注處理中' }
    if (slots.length === 0) {
      state.message = '請至少加入一組注單'
      return { ok: false, message: state.message }
    }
    state.submitStatus = 'loading'
    state.errorMessage = ''
    state.message = ''
    try {
      const result = await api.lottery.bet({
        lottery: { id: lotteryMeta.value.id, key: lotteryMeta.value.key },
        amount: BINGO_BET_UNIT,
        slots: slots.map((slot) => ({ ...slot, id: undefined })) as unknown as Array<Record<string, unknown>>
      })
      state.submitStatus = 'success'
      state.message = result?.message ?? '下注成功'
      state.lastOrderId = String(result?.orderId ?? '')
      wallet.coin = Number(result?.coin ?? wallet.coin)
      const readyAmount = slots.length * BINGO_BET_UNIT
      const readyCount = slots.length
      _actions.clearAll()
      await Promise.all([fetch.userInfo(), fetch.userRecordAll()])
      return { ok: true, message: state.message, count: readyCount, amount: readyAmount }
    } catch (error) {
      state.submitStatus = 'error'
      const err = error as { data?: { message?: string; statusMessage?: string; data?: { code?: number } }; statusCode?: number }
      state.errorMessage = String(
        err?.data?.message ?? err?.data?.statusMessage ?? (error instanceof Error ? error.message : '下注失敗')
      )
      const isLoginExpired = err?.data?.data?.code === STATUS_ERR_CODE[40001].code
        || err?.statusCode === STATUS_ERR_CODE[40001].httpStatus
      return { ok: false, message: state.errorMessage, loginExpired: isLoginExpired }
    }
  },
  initPageData: async () => {
    state.fetchStatus = 'loading'
    await Promise.all([fetch.refreshCurrentInfo(), fetch.userInfo(), fetch.openCodeHistoryAll()])
    state.fetchStatus = 'success'
  },
  startPolling: () => {
    if (!clockTimer) clockTimer = setInterval(_tickServerNow, 1000)
    if (!pollTimer) {
      // 賓果賓果每 5 分鐘一期，前端輪詢頻率比 P3/P4（15 秒）更密，才不會漏過整期的開盤時間
      pollTimer = setInterval(() => {
        const before = String(current.runtime?.issue ?? '')
        fetch.refreshCurrentInfo().then(() => {
          if (String(current.runtime?.issue ?? '') === before) return
          fetch.userRecordAll()
          fetch.openCodeHistoryAll()
        })
      }, 5000)
    }
  },
  stopPolling: () => {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }
}

export function useBingo() {
  return {
    state,
    current,
    starDraft,
    superDraft,
    slots,
    wallet,
    time,
    userRecord,
    openCodeHistory,

    lotteryMeta,
    totalAmount,
    canAddSlot,
    isOpen,
    isPendingSettlement,
    canSubmit,
    countdownLabel,
    starDraftReady,

    actions: _actions,
    fetch
  }
}
