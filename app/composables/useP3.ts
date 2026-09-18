import { computed, reactive, watch } from 'vue'
import { LOTTERY, STATUS_TIME, STATUS_ERR_CODE } from '~/config/constants'
import {
  api,
  type P3Current,
  type P3UserBetHistory,
  type LotteryUserBalanceChange,
  type LotteryClaimableIssue,
  type LotteryOpenCodeHistoryItem
} from '~/services/api'
import {
  P3_BET_AMOUNT,
  P3_MAX_SLOTS,
  P3_DIGIT_MIN,
  P3_DIGIT_MAX,
  P3_DIGIT_COUNT,
  P3_BET_TYPES,
  p3IsTriple,
  type P3BetType
} from '#shared/config/p3'

/**
 * 3星彩（P3）前端狀態
 *
 * ── 與 M649/M539「選號碼池」最大的互動差異 ──────────────────────────
 *   每一組（A~E）要先選「下注方式」（正彩/組彩/前二對彩/後二對彩，見 P3_BET_TYPES），
 *   再逐位填滿 3 位 0~9 數字（可重複）；切換下注方式時該組已選數字會清空。
 *   每組固定 25 coin，四種下注方式同一價，派彩金額完全鏡射官方（對彩固定 750，見 shared/config/p3.ts）。
 *
 * ⚠️ state 是 module 級單例（比照 useM649 / useM539 等既有玩法）。
 */

export type P3Slot = {
  id: string
  betType: P3BetType
  /** 3 位數字（0~9，可重複），尚未填滿的位置為 null */
  digits: Array<number | null>
  isQuickPick: boolean
}

const SLOT_IDS = ['A', 'B', 'C', 'D', 'E']

function _emptySlot(id: string): P3Slot {
  return { id, betType: 'zhengcai', digits: Array.from({ length: P3_DIGIT_COUNT }, () => null), isQuickPick: false }
}

// ── Module-level singletons ────────────────────────────────────────────────
const state = reactive({
  fetchStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',
  submitStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',
  message: '' as string,
  errorMessage: '' as string,
  lastOrderId: '' as string
})

const current = reactive({
  runtime: null as P3Current | null
})

const slots = reactive<P3Slot[]>([_emptySlot('A'), _emptySlot('B')])

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
  betHistory: [] as P3UserBetHistory[],
  claimableIssues: [] as LotteryClaimableIssue[]
})

const openCodeHistory = reactive({
  isLoading: false,
  errorMessage: '',
  list: [] as LotteryOpenCodeHistoryItem[]
})

// ── Computed ───────────────────────────────────────────────────────────────
const lotteryMeta = computed(() => LOTTERY.P3)
/** 可選下注方式清單（給 Board.vue 渲染切換 UI 用） */
const betTypeOptions = computed(() => P3_BET_TYPES)
/** 已填滿 3 位數字、可送單的組別 */
const filledSlots = computed(() => slots.filter((slot) => slot.digits.every((d) => d !== null)))
const totalAmount = computed(() => filledSlots.value.length * P3_BET_AMOUNT)
const canAddSlot = computed(() => slots.length < P3_MAX_SLOTS)
const isOpen = computed(() => String(current.runtime?.currentStatus ?? '') === STATUS_TIME.OPEN)
const isPendingSettlement = computed(() => String(current.runtime?.currentStatus ?? '') === STATUS_TIME.PENDING_SETTLEMENT)
const canSubmit = computed(() => isOpen.value && state.submitStatus !== 'loading' && filledSlots.value.length > 0)
/** 倒數文字（天/時/分，跟今彩539同為每天開獎的週期） */
const countdownLabel = computed(() => current.runtime?.countdown ?? '')
/** 熱門選號：本期已下注的「下注方式＋數字」依人數排序前 5 組；本期還沒人下注時，後端會改回傳 5 組隨機組合 */
const popularNumbers = computed(() => current.runtime?.popularNumbers ?? [])

const WEEKDAY_LABEL = ['日', '一', '二', '三', '四', '五', '六']
const drawAtDateLabel = computed(() => {
  const ms = current.runtime?.drawAt
  if (!ms) return ''
  const d = new Date(ms)
  return `${d.getMonth() + 1}/${d.getDate()}`
})
const drawAtWeekdayLabel = computed(() => {
  const ms = current.runtime?.drawAt
  if (!ms) return ''
  return WEEKDAY_LABEL[new Date(ms).getDay()] ?? ''
})
const drawAtTimeLabel = computed(() => {
  const ms = current.runtime?.drawAt
  if (!ms) return ''
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
})

// ── Helpers ────────────────────────────────────────────────────────────────
function _tickServerNow() {
  time.nowMs = time.syncedAtServerMs <= 0 || time.syncedAtClientMs <= 0
    ? Date.now()
    : time.syncedAtServerMs + (Date.now() - time.syncedAtClientMs)
}

function _randomDigits(betType: P3BetType): number[] {
  let digits: number[]
  do {
    digits = Array.from({ length: P3_DIGIT_COUNT }, () => Math.floor(Math.random() * (P3_DIGIT_MAX - P3_DIGIT_MIN + 1)) + P3_DIGIT_MIN)
  } while (betType === 'zucai' && p3IsTriple(digits))
  return digits
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
  /** 切換某一組的下注方式；下注方式改變代表判定規則不同，該組已選數字一併清空 */
  setBetType: (slotId: string, betType: P3BetType) => {
    if (!P3_BET_TYPES.some((t) => t.key === betType)) return
    const slot = slots.find((s) => s.id === slotId)
    if (!slot || slot.betType === betType) return
    slot.betType = betType
    slot.digits = Array.from({ length: P3_DIGIT_COUNT }, () => null)
    slot.isQuickPick = false
  },
  /** 設定某一組某一位（百/十/個）的數字（0~9） */
  setDigit: (slotId: string, position: number, digit: number) => {
    const slot = slots.find((s) => s.id === slotId)
    if (!slot || position < 0 || position >= P3_DIGIT_COUNT) return
    if (!Number.isInteger(digit) || digit < P3_DIGIT_MIN || digit > P3_DIGIT_MAX) return
    slot.digits[position] = digit
    slot.isQuickPick = false
  },
  /** 電腦選號：該組立即依目前下注方式產生 3 位數字（組彩會避開豹子），玩家仍可再手動調整 */
  quickPick: (slotId: string) => {
    const slot = slots.find((s) => s.id === slotId)
    if (!slot) return
    slot.digits = _randomDigits(slot.betType)
    slot.isQuickPick = true
  },
  clearSlot: (slotId: string) => {
    const slot = slots.find((s) => s.id === slotId)
    if (!slot) return
    slot.digits = Array.from({ length: P3_DIGIT_COUNT }, () => null)
    slot.isQuickPick = false
  },
  /** 新增一組（最多 5 組，即 A~E），預設玩正彩 */
  addSlot: () => {
    if (slots.length >= P3_MAX_SLOTS) return
    const usedIds = new Set(slots.map((s) => s.id))
    const nextId = SLOT_IDS.find((id) => !usedIds.has(id))
    if (!nextId) return
    slots.push(_emptySlot(nextId))
  },
  /** 刪除某一組（至少保留 1 組，刪到剩最後一組時只清空不刪除） */
  removeSlot: (slotId: string) => {
    if (slots.length <= 1) {
      _actions.clearSlot(slotId)
      return
    }
    const idx = slots.findIndex((s) => s.id === slotId)
    if (idx >= 0) slots.splice(idx, 1)
  },
  clearAll: () => {
    slots.splice(0, slots.length, _emptySlot('A'), _emptySlot('B'))
  },
  /**
   * 把一組已知的下注方式＋數字套用到投注區（「熱門選號」的「來一注」按鈕用）。
   * 優先套進第一個空組；都滿了在未達上限時新增一組；已達上限才覆蓋第一組（極少見情境）。
   */
  applyPick: (betType: P3BetType, digits: number[]) => {
    const normalized = digits.slice(0, P3_DIGIT_COUNT)
    const empty = slots.find((s) => s.digits.every((d) => d === null))
    if (empty) {
      empty.betType = betType
      empty.digits = normalized
      empty.isQuickPick = false
      return
    }
    if (slots.length < P3_MAX_SLOTS) {
      const usedIds = new Set(slots.map((s) => s.id))
      const nextId = SLOT_IDS.find((id) => !usedIds.has(id))
      if (nextId) {
        slots.push({ id: nextId, betType, digits: normalized, isQuickPick: false })
        return
      }
    }
    const first = slots[0]
    if (first) {
      first.betType = betType
      first.digits = normalized
      first.isQuickPick = false
    }
  },
  /** 「近期開獎」的「來一注」：套用官方開出的數字，預設為正彩（玩家可自行切換下注方式） */
  applyNumbers: (digits: number[]) => {
    _actions.applyPick('zhengcai', digits)
  }
}

// ── Fetch ──────────────────────────────────────────────────────────────────
const fetch = {
  refreshCurrentInfo: async () => {
    try {
      const result = await api.lottery.currentP3()
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
      const res = await api.lottery.userRecordP3()
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
      const res = await api.lottery.openCodeHistoryP3()
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
      const res = await api.lottery.claimOneIssueP3()
      if (res?.ok) {
        wallet.coin = Number(res.coin ?? wallet.coin)
        await fetch.userRecordAll()
      }
      return res
    } finally {
      userRecord.isSubmittingClaim = false
    }
  },
  /** 送單：把已填滿 3 位數字的組別（A~E）各自組成一筆獨立注單，一次送出 */
  submit: async () => {
    if (state.submitStatus === 'loading') return { ok: false, message: '投注處理中' }
    const readySlots = filledSlots.value
    if (readySlots.length === 0) {
      state.message = '請至少填滿一組 3 位數字'
      return { ok: false, message: state.message }
    }
    state.submitStatus = 'loading'
    state.errorMessage = ''
    state.message = ''
    try {
      const result = await api.lottery.bet({
        lottery: { id: lotteryMeta.value.id, key: lotteryMeta.value.key },
        amount: P3_BET_AMOUNT,
        slots: readySlots.map((slot) => ({ betType: slot.betType, digits: slot.digits as number[] }))
      })
      state.submitStatus = 'success'
      state.message = result?.message ?? '下注成功'
      state.lastOrderId = String(result?.orderId ?? '')
      wallet.coin = Number(result?.coin ?? wallet.coin)
      const readyAmount = readySlots.length * P3_BET_AMOUNT
      _actions.clearAll()
      await Promise.all([fetch.userInfo(), fetch.userRecordAll()])
      return { ok: true, message: state.message, count: readySlots.length, amount: readyAmount }
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
      pollTimer = setInterval(() => {
        const before = String(current.runtime?.issue ?? '')
        fetch.refreshCurrentInfo().then(() => {
          if (String(current.runtime?.issue ?? '') === before) return
          // 內部佔位期別換了代表上一期已結算：注單結果、可領獎金、開獎歷史一起刷新
          fetch.userRecordAll()
          fetch.openCodeHistoryAll()
        })
      }, 15000)
    }
  },
  stopPolling: () => {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }
}

export function useP3() {
  return {
    state,
    current,
    slots,
    wallet,
    time,
    userRecord,
    openCodeHistory,

    lotteryMeta,
    betTypeOptions,
    filledSlots,
    totalAmount,
    canAddSlot,
    isOpen,
    isPendingSettlement,
    canSubmit,
    countdownLabel,
    drawAtDateLabel,
    drawAtWeekdayLabel,
    drawAtTimeLabel,
    popularNumbers,

    actions: _actions,
    fetch
  }
}
