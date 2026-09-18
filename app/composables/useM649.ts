import { computed, reactive, watch } from 'vue'
import { LOTTERY, STATUS_TIME, STATUS_ERR_CODE } from '~/config/constants'
import {
  api,
  type M649Current,
  type M649UserBetHistory,
  type LotteryUserBalanceChange,
  type LotteryClaimableIssue,
  type LotteryOpenCodeHistoryItem
} from '~/services/api'
import { M649_BET_AMOUNT, M649_MAX_SLOTS, M649_NUMBER_MIN, M649_NUMBER_MAX, M649_PICK_OPTIONS } from '#shared/config/m649'

/**
 * 49樂合彩（M649）前端狀態
 *
 * ── 與 DLT/D539「選固定 N 個號碼」最大的互動差異 ──────────────────
 *   每一組（A~E）要先選「玩幾合」（二合/三合/四合，即 2/3/4），再選滿對應數量的號碼；
 *   開獎後號碼**全部**被開出才中獎（二元的中／不中，見 shared/config/m649.ts 的 isHit）。
 *   合數是**每組各自獨立**的（A 可以玩二合、B 可以玩四合），切換某組合數時該組已選號碼會清空。
 *   每組固定 25 coin（DLT/D539 是 50），派彩金額完全鏡射官方，下注當下不顯示金額。
 *
 * ⚠️ state 是 module 級單例（比照 useDlt / useD539 等既有玩法）。
 */

export type M649Slot = {
  id: string
  /** 這組要玩「幾合」（2/3/4），決定要選滿幾個號碼 */
  pickCount: number
  numbers: number[]
  isQuickPick: boolean
}

const SLOT_IDS = ['A', 'B', 'C', 'D', 'E']
/** 可選合數的最小／最大值（2 / 4），供 applyNumbers 決定套用哪種合數 */
const MIN_PICK = Math.min(...M649_PICK_OPTIONS)
const MAX_PICK = Math.max(...M649_PICK_OPTIONS)

function _emptySlot(id: string): M649Slot {
  return { id, pickCount: MIN_PICK, numbers: [], isQuickPick: false }
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
  runtime: null as M649Current | null
})

const slots = reactive<M649Slot[]>([_emptySlot('A'), _emptySlot('B')])

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
  betHistory: [] as M649UserBetHistory[],
  claimableIssues: [] as LotteryClaimableIssue[]
})

const openCodeHistory = reactive({
  isLoading: false,
  errorMessage: '',
  list: [] as LotteryOpenCodeHistoryItem[]
})

// ── Computed ───────────────────────────────────────────────────────────────
const lotteryMeta = computed(() => LOTTERY.M649)
/** 可選合數清單（給 Board.vue 渲染切換 UI 用） */
const pickOptions = computed(() => [...M649_PICK_OPTIONS])
/** 已選滿對應合數號碼、可送單的組別（各組的門檻是自己的 pickCount，不是固定值） */
const filledSlots = computed(() => slots.filter((slot) => slot.numbers.length === slot.pickCount))
const totalAmount = computed(() => filledSlots.value.length * M649_BET_AMOUNT)
const canAddSlot = computed(() => slots.length < M649_MAX_SLOTS)
const isOpen = computed(() => String(current.runtime?.currentStatus ?? '') === STATUS_TIME.OPEN)
const isPendingSettlement = computed(() => String(current.runtime?.currentStatus ?? '') === STATUS_TIME.PENDING_SETTLEMENT)
const canSubmit = computed(() => isOpen.value && state.submitStatus !== 'loading' && filledSlots.value.length > 0)
/** 倒數文字（天/時/分，跟大樂透同為每週二五的長週期） */
const countdownLabel = computed(() => current.runtime?.countdown ?? '')
/** 熱門選號：本期已下注的注碼依人數排序前 5 組；本期還沒人下注時，後端會改回傳 5 組隨機注碼 */
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
  const pool = Array.from({ length: M649_NUMBER_MAX - M649_NUMBER_MIN + 1 }, (_, i) => M649_NUMBER_MIN + i)
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
  /** 切換某一組要玩「幾合」（2/3/4）；合數改變代表要選的號碼數不同，該組已選號碼一併清空 */
  setPickCount: (slotId: string, pickCount: number) => {
    if (!(M649_PICK_OPTIONS as readonly number[]).includes(pickCount)) return
    const slot = slots.find((s) => s.id === slotId)
    if (!slot || slot.pickCount === pickCount) return
    slot.pickCount = pickCount
    slot.numbers = []
    slot.isQuickPick = false
  },
  /** 切換某一組的某個號碼（已選滿該組合數時，未選中的號碼點了不會生效） */
  toggleNumber: (slotId: string, num: number) => {
    const slot = slots.find((s) => s.id === slotId)
    if (!slot) return
    const idx = slot.numbers.indexOf(num)
    if (idx >= 0) {
      slot.numbers.splice(idx, 1)
      slot.isQuickPick = false
      return
    }
    if (slot.numbers.length >= slot.pickCount) return
    slot.numbers.push(num)
    slot.numbers.sort((a, b) => a - b)
    slot.isQuickPick = false
  },
  /** 電腦選號：該組立即依自己的合數產生對應個數的不重複號碼，玩家仍可再手動調整 */
  quickPick: (slotId: string) => {
    const slot = slots.find((s) => s.id === slotId)
    if (!slot) return
    slot.numbers = _randomNumbers(slot.pickCount)
    slot.isQuickPick = true
  },
  clearSlot: (slotId: string) => {
    const slot = slots.find((s) => s.id === slotId)
    if (!slot) return
    slot.numbers = []
    slot.isQuickPick = false
  },
  /** 新增一組（最多 5 組，即 A~E），預設玩二合 */
  addSlot: () => {
    if (slots.length >= M649_MAX_SLOTS) return
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
   * 把一組已知號碼套用到投注區（「近期開獎」「熱門選號」的「來一注」按鈕用）。合數依號碼數決定：
   * 正好是可選合數（2/3/4）就直接用；超過 4（例如開獎的 6 個號碼）取前 4 當四合；不足 2 補到二合。
   * 優先套進第一個空組；都滿了在未達上限時新增一組；已達上限才覆蓋第一組（極少見情境）。
   */
  applyNumbers: (numbers: number[]) => {
    const normalized = [...new Set(numbers.map((n) => Number(n)))].filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
    let pickCount = MIN_PICK
    let picked = normalized.slice(0, MIN_PICK)
    if ((M649_PICK_OPTIONS as readonly number[]).includes(normalized.length)) {
      pickCount = normalized.length
      picked = normalized
    } else if (normalized.length > MAX_PICK) {
      pickCount = MAX_PICK
      picked = normalized.slice(0, MAX_PICK)
    }

    const empty = slots.find((s) => s.numbers.length === 0)
    if (empty) {
      empty.pickCount = pickCount
      empty.numbers = picked
      empty.isQuickPick = false
      return
    }
    if (slots.length < M649_MAX_SLOTS) {
      const usedIds = new Set(slots.map((s) => s.id))
      const nextId = SLOT_IDS.find((id) => !usedIds.has(id))
      if (nextId) {
        slots.push({ id: nextId, pickCount, numbers: picked, isQuickPick: false })
        return
      }
    }
    const first = slots[0]
    if (first) {
      first.pickCount = pickCount
      first.numbers = picked
      first.isQuickPick = false
    }
  }
}

// ── Fetch ──────────────────────────────────────────────────────────────────
const fetch = {
  refreshCurrentInfo: async () => {
    try {
      const result = await api.lottery.currentM649()
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
      const res = await api.lottery.userRecordM649()
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
      const res = await api.lottery.openCodeHistoryM649()
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
      const res = await api.lottery.claimOneIssueM649()
      if (res?.ok) {
        wallet.coin = Number(res.coin ?? wallet.coin)
        await fetch.userRecordAll()
      }
      return res
    } finally {
      userRecord.isSubmittingClaim = false
    }
  },
  /** 送單：把已選滿對應合數號碼的組別（A~E）各自組成一筆獨立注單，一次送出 */
  submit: async () => {
    if (state.submitStatus === 'loading') return { ok: false, message: '投注處理中' }
    const readySlots = filledSlots.value
    if (readySlots.length === 0) {
      state.message = '請至少選滿一組（依所選合數選滿號碼）'
      return { ok: false, message: state.message }
    }
    state.submitStatus = 'loading'
    state.errorMessage = ''
    state.message = ''
    try {
      const result = await api.lottery.bet({
        lottery: { id: lotteryMeta.value.id, key: lotteryMeta.value.key },
        amount: M649_BET_AMOUNT,
        slots: readySlots.map((slot) => ({ numbers: slot.numbers }))
      })
      state.submitStatus = 'success'
      state.message = result?.message ?? '下注成功'
      state.lastOrderId = String(result?.orderId ?? '')
      wallet.coin = Number(result?.coin ?? wallet.coin)
      const readyAmount = readySlots.length * M649_BET_AMOUNT
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

export function useM649() {
  return {
    state,
    current,
    slots,
    wallet,
    time,
    userRecord,
    openCodeHistory,

    lotteryMeta,
    pickOptions,
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
