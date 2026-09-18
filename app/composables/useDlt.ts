import { computed, reactive, watch } from 'vue'
import { LOTTERY, STATUS_TIME, STATUS_ERR_CODE } from '~/config/constants'
import {
  api,
  type DltCurrent,
  type DltUserBetHistory,
  type LotteryUserBalanceChange,
  type LotteryClaimableIssue,
  type LotteryOpenCodeHistoryItem
} from '~/services/api'
import { DLT_BET_AMOUNT, DLT_MAX_SLOTS, DLT_NUMBER_MIN, DLT_NUMBER_MAX, DLT_PICK_COUNT } from '#shared/config/dlt'

/**
 * 大樂透（DLT）前端狀態
 *
 * ── 與其他所有彩種最大的不同 ────────────────────────────────
 *   沒有賠率／彩池概念：下注前 `current.runtime.tiers` 只有獎項名稱／對中條件，沒有金額；
 *   要等開獎結算後，`userRecord.betHistory` 裡每筆注單才會補上 `winAmount`
 *   （＝官方當期該獎項實際 perPrize，見 server dlt.ts）。
 *   投注區還原官方紙本投注單：A~E 最多 5 組，每組各自 6 個號碼、固定 50 coin，
 *   不是複式（見 openspec/changes/add-dlt/design.md Decision 8/9）。
 *
 * ⚠️ state 是 module 級單例（比照 usePl3 / useEggs 等既有玩法）。
 */

export type DltSlot = {
  id: string
  numbers: number[]
  isQuickPick: boolean
}

const SLOT_IDS = ['A', 'B', 'C', 'D', 'E']

function _emptySlot(id: string): DltSlot {
  return { id, numbers: [], isQuickPick: false }
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
  runtime: null as DltCurrent | null
})

const slots = reactive<DltSlot[]>([_emptySlot('A'), _emptySlot('B')])

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
  betHistory: [] as DltUserBetHistory[],
  claimableIssues: [] as LotteryClaimableIssue[]
})

const openCodeHistory = reactive({
  isLoading: false,
  errorMessage: '',
  list: [] as LotteryOpenCodeHistoryItem[]
})

// ── Computed ───────────────────────────────────────────────────────────────
const lotteryMeta = computed(() => LOTTERY.DLT)
/** 已選滿 6 碼、可送單的組別 */
const filledSlots = computed(() => slots.filter((slot) => slot.numbers.length === DLT_PICK_COUNT))
const totalAmount = computed(() => filledSlots.value.length * DLT_BET_AMOUNT)
const canAddSlot = computed(() => slots.length < DLT_MAX_SLOTS)
const isOpen = computed(() => String(current.runtime?.currentStatus ?? '') === STATUS_TIME.OPEN)
const isPendingSettlement = computed(() => String(current.runtime?.currentStatus ?? '') === STATUS_TIME.PENDING_SETTLEMENT)
const canSubmit = computed(() => isOpen.value && state.submitStatus !== 'loading' && filledSlots.value.length > 0)
/** 倒數文字（天/時/分，比照每週二五的長週期，不是分鐘級玩法常見的秒數倒數） */
const countdownLabel = computed(() => current.runtime?.countdown ?? '')
/** 熱門選號：本期已下注的注碼依人數排序前 5 組；本期還沒人下注時，後端會改回傳 5 組隨機號碼 */
const popularNumbers = computed(() => current.runtime?.popularNumbers ?? [])

const WEEKDAY_LABEL = ['日', '一', '二', '三', '四', '五', '六']
/**
 * 開獎時間拆成「日期」「星期」「時間」三段，供 Header.vue 顯示「何時開獎」用——
 * 星期跟後面的「開獎」字樣要用比日期/時間更小的字級，所以拆開讓樣板分別包 span。
 */
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

function _randomNumbers(count: number): number[] {
  const pool = Array.from({ length: DLT_NUMBER_MAX - DLT_NUMBER_MIN + 1 }, (_, i) => DLT_NUMBER_MIN + i)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = pool[i] as number
    pool[i] = pool[j] as number
    pool[j] = tmp
  }
  return pool.slice(0, count).sort((a, b) => a - b)
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
  /** 切換某一組的某個號碼（已選滿 6 個時，未選中的號碼點了不會生效） */
  toggleNumber: (slotId: string, num: number) => {
    const slot = slots.find((s) => s.id === slotId)
    if (!slot) return
    const idx = slot.numbers.indexOf(num)
    if (idx >= 0) {
      slot.numbers.splice(idx, 1)
      slot.isQuickPick = false
      return
    }
    if (slot.numbers.length >= DLT_PICK_COUNT) return
    slot.numbers.push(num)
    slot.numbers.sort((a, b) => a - b)
    slot.isQuickPick = false
  },
  /** 電腦選號：該組立即產生 6 個不重複號碼，玩家仍可再手動調整（見 Decision 9） */
  quickPick: (slotId: string) => {
    const slot = slots.find((s) => s.id === slotId)
    if (!slot) return
    slot.numbers = _randomNumbers(DLT_PICK_COUNT)
    slot.isQuickPick = true
  },
  clearSlot: (slotId: string) => {
    const slot = slots.find((s) => s.id === slotId)
    if (!slot) return
    slot.numbers = []
    slot.isQuickPick = false
  },
  /** 新增一組（最多 5 組，即 A~E） */
  addSlot: () => {
    if (slots.length >= DLT_MAX_SLOTS) return
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
   * 把一組已知的 6 個號碼套用到投注區（「近期開獎」的「來一注」按鈕用，見 History.vue）。
   * 優先套進第一個還空著的組別；都滿了就在還沒到上限時新增一組；已到 DLT_MAX_SLOTS
   * 上限才會覆蓋第一組（極少見情境，5 組都已選滿才會走到這裡）。
   */
  applyNumbers: (numbers: number[]) => {
    const normalized = [...new Set(numbers)].sort((a, b) => a - b)
    const empty = slots.find((s) => s.numbers.length === 0)
    if (empty) {
      empty.numbers = normalized
      empty.isQuickPick = false
      return
    }
    if (slots.length < DLT_MAX_SLOTS) {
      const usedIds = new Set(slots.map((s) => s.id))
      const nextId = SLOT_IDS.find((id) => !usedIds.has(id))
      if (nextId) {
        slots.push({ id: nextId, numbers: normalized, isQuickPick: false })
        return
      }
    }
    const first = slots[0]
    if (first) {
      first.numbers = normalized
      first.isQuickPick = false
    }
  }
}

// ── Fetch ──────────────────────────────────────────────────────────────────
const fetch = {
  refreshCurrentInfo: async () => {
    try {
      const result = await api.lottery.currentDlt()
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
      const res = await api.lottery.userRecordDlt()
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
      const res = await api.lottery.openCodeHistoryDlt()
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
      const res = await api.lottery.claimOneIssueDlt()
      if (res?.ok) {
        wallet.coin = Number(res.coin ?? wallet.coin)
        await fetch.userRecordAll()
      }
      return res
    } finally {
      userRecord.isSubmittingClaim = false
    }
  },
  /** 送單：把已選滿 6 碼的組別（A~E）各自組成一筆獨立注單，一次送出 */
  submit: async () => {
    if (state.submitStatus === 'loading') return { ok: false, message: '投注處理中' }
    const readySlots = filledSlots.value
    if (readySlots.length === 0) {
      state.message = '請至少選滿一組 6 個號碼'
      return { ok: false, message: state.message }
    }
    state.submitStatus = 'loading'
    state.errorMessage = ''
    state.message = ''
    try {
      const result = await api.lottery.bet({
        lottery: { id: lotteryMeta.value.id, key: lotteryMeta.value.key },
        amount: DLT_BET_AMOUNT,
        slots: readySlots.map((slot) => ({ numbers: slot.numbers }))
      })
      state.submitStatus = 'success'
      state.message = result?.message ?? '下注成功'
      state.lastOrderId = String(result?.orderId ?? '')
      wallet.coin = Number(result?.coin ?? wallet.coin)
      const readyAmount = readySlots.length * DLT_BET_AMOUNT
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

export function useDlt() {
  return {
    state,
    current,
    slots,
    wallet,
    time,
    userRecord,
    openCodeHistory,

    lotteryMeta,
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
