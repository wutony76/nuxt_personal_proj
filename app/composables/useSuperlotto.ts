import { computed, reactive, watch } from 'vue'
import { LOTTERY, STATUS_TIME, STATUS_ERR_CODE } from '~/config/constants'
import {
  api,
  type SuperlottoCurrent,
  type SuperlottoUserBetHistory,
  type LotteryUserBalanceChange,
  type LotteryClaimableIssue,
  type LotteryOpenCodeHistoryItem
} from '~/services/api'
import {
  SUPERLOTTO_BET_AMOUNT,
  SUPERLOTTO_MAX_SLOTS,
  SUPERLOTTO_ZONE_A_MIN,
  SUPERLOTTO_ZONE_A_MAX,
  SUPERLOTTO_ZONE_A_PICK,
  SUPERLOTTO_ZONE_B_MIN,
  SUPERLOTTO_ZONE_B_MAX
} from '#shared/config/superlotto'

/**
 * 威力彩（SUPERLOTTO）前端狀態——本站唯一「兩區選號」的玩法（見
 * openspec/changes/add-tw-lottery-suite/design.md Decision 4）。
 *
 * ── 與 DLT 最大的差異：slot 有兩區 ────────────────────────────────
 *   slot 資料結構為 `{ zoneA: number[], zoneB: number | null }`（不是 DLT 的單一 numbers）；
 *   `toggleNumber(slotId, zone, num)` 多帶一個 `zone` 參數區分操作第一區（'a'）或第二區（'b'）。
 *   第一區選滿 6、第二區選滿 1 才算「選滿一組」可送單，每組固定 100 coin。
 *   沒有賠率／彩池概念：下注前 `current.runtime.tiers` 只有獎項名稱／對中條件，沒有金額；
 *   要等開獎結算後，`userRecord.betHistory` 裡每筆注單才會補上 `winAmount`（＝官方當期 perPrize）。
 *
 * ⚠️ state 是 module 級單例（比照 useDlt 等既有玩法）。
 */

export type SuperlottoSlot = {
  id: string
  zoneA: number[]
  zoneB: number | null
  isQuickPick: boolean
}

export type SuperlottoZone = 'a' | 'b'

const SLOT_IDS = ['A', 'B', 'C', 'D', 'E']

function _emptySlot(id: string): SuperlottoSlot {
  return { id, zoneA: [], zoneB: null, isQuickPick: false }
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
  runtime: null as SuperlottoCurrent | null
})

const slots = reactive<SuperlottoSlot[]>([_emptySlot('A')])

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
  betHistory: [] as SuperlottoUserBetHistory[],
  claimableIssues: [] as LotteryClaimableIssue[]
})

const openCodeHistory = reactive({
  isLoading: false,
  errorMessage: '',
  list: [] as LotteryOpenCodeHistoryItem[]
})

// ── Computed ───────────────────────────────────────────────────────────────
const lotteryMeta = computed(() => LOTTERY.SUPERLOTTO)
/** 已選滿（第一區 6 碼＋第二區 1 碼）、可送單的組別 */
const filledSlots = computed(() =>
  slots.filter((slot) => slot.zoneA.length === SUPERLOTTO_ZONE_A_PICK && slot.zoneB !== null)
)
const totalAmount = computed(() => filledSlots.value.length * SUPERLOTTO_BET_AMOUNT)
const canAddSlot = computed(() => slots.length < SUPERLOTTO_MAX_SLOTS)
const isOpen = computed(() => String(current.runtime?.currentStatus ?? '') === STATUS_TIME.OPEN)
const isPendingSettlement = computed(() => String(current.runtime?.currentStatus ?? '') === STATUS_TIME.PENDING_SETTLEMENT)
const canSubmit = computed(() => isOpen.value && state.submitStatus !== 'loading' && filledSlots.value.length > 0)
/** 倒數文字（天/時/分，比照每週一四的長週期，不是分鐘級玩法常見的秒數倒數） */
const countdownLabel = computed(() => current.runtime?.countdown ?? '')
/** 熱門選號：本期已下注的注碼依人數排序前 5 組；本期還沒人下注時，後端會改回傳 5 組隨機號碼 */
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

function _randomZoneA(): number[] {
  const pool = Array.from({ length: SUPERLOTTO_ZONE_A_MAX - SUPERLOTTO_ZONE_A_MIN + 1 }, (_, i) => SUPERLOTTO_ZONE_A_MIN + i)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = pool[i] as number
    pool[i] = pool[j] as number
    pool[j] = tmp
  }
  return pool.slice(0, SUPERLOTTO_ZONE_A_PICK).sort((a, b) => a - b)
}

function _randomZoneB(): number {
  return Math.floor(Math.random() * (SUPERLOTTO_ZONE_B_MAX - SUPERLOTTO_ZONE_B_MIN + 1)) + SUPERLOTTO_ZONE_B_MIN
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
  /**
   * 切換某一組某一區的某個號碼。
   * 第一區（'a'）：已選滿 6 個時，未選中的號碼點了不會生效。
   * 第二區（'b'）：單選——點已選中的取消、點別的直接換成新號碼。
   */
  toggleNumber: (slotId: string, zone: SuperlottoZone, num: number) => {
    const slot = slots.find((s) => s.id === slotId)
    if (!slot) return
    if (zone === 'a') {
      const idx = slot.zoneA.indexOf(num)
      if (idx >= 0) {
        slot.zoneA.splice(idx, 1)
        slot.isQuickPick = false
        return
      }
      if (slot.zoneA.length >= SUPERLOTTO_ZONE_A_PICK) return
      slot.zoneA.push(num)
      slot.zoneA.sort((a, b) => a - b)
      slot.isQuickPick = false
      return
    }
    // zone === 'b'：單選
    slot.zoneB = slot.zoneB === num ? null : num
    slot.isQuickPick = false
  },
  /** 電腦選號：該組立即產生第一區 6 個＋第二區 1 個號碼，玩家仍可再手動調整 */
  quickPick: (slotId: string) => {
    const slot = slots.find((s) => s.id === slotId)
    if (!slot) return
    slot.zoneA = _randomZoneA()
    slot.zoneB = _randomZoneB()
    slot.isQuickPick = true
  },
  clearSlot: (slotId: string) => {
    const slot = slots.find((s) => s.id === slotId)
    if (!slot) return
    slot.zoneA = []
    slot.zoneB = null
    slot.isQuickPick = false
  },
  /** 新增一組（最多 5 組，即 A~E） */
  addSlot: () => {
    if (slots.length >= SUPERLOTTO_MAX_SLOTS) return
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
    slots.splice(0, slots.length, _emptySlot('A'))
  },
  /**
   * 把一組已知的兩區號碼套用到投注區（「近期開獎」「熱門選號」的「來一注」按鈕用）。
   * 優先套進第一個還空著的組別；都滿了就在還沒到上限時新增一組；已到上限才覆蓋第一組。
   */
  applyNumbers: (zoneA: number[], zoneB: number | null) => {
    const normalizedA = [...new Set(zoneA)].sort((a, b) => a - b).slice(0, SUPERLOTTO_ZONE_A_PICK)
    const empty = slots.find((s) => s.zoneA.length === 0 && s.zoneB === null)
    if (empty) {
      empty.zoneA = normalizedA
      empty.zoneB = zoneB
      empty.isQuickPick = false
      return
    }
    if (slots.length < SUPERLOTTO_MAX_SLOTS) {
      const usedIds = new Set(slots.map((s) => s.id))
      const nextId = SLOT_IDS.find((id) => !usedIds.has(id))
      if (nextId) {
        slots.push({ id: nextId, zoneA: normalizedA, zoneB, isQuickPick: false })
        return
      }
    }
    const first = slots[0]
    if (first) {
      first.zoneA = normalizedA
      first.zoneB = zoneB
      first.isQuickPick = false
    }
  }
}

// ── Fetch ──────────────────────────────────────────────────────────────────
const fetch = {
  refreshCurrentInfo: async () => {
    try {
      const result = await api.lottery.currentSuperlotto()
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
      const res = await api.lottery.userRecordSuperlotto()
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
      const res = await api.lottery.openCodeHistorySuperlotto()
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
      const res = await api.lottery.claimOneIssueSuperlotto()
      if (res?.ok) {
        wallet.coin = Number(res.coin ?? wallet.coin)
        await fetch.userRecordAll()
      }
      return res
    } finally {
      userRecord.isSubmittingClaim = false
    }
  },
  /** 送單：把已選滿兩區的組別（A~E）各自組成一筆獨立注單，一次送出 */
  submit: async () => {
    if (state.submitStatus === 'loading') return { ok: false, message: '投注處理中' }
    const readySlots = filledSlots.value
    if (readySlots.length === 0) {
      state.message = '請至少選滿一組（第一區 6 碼＋第二區 1 碼）'
      return { ok: false, message: state.message }
    }
    state.submitStatus = 'loading'
    state.errorMessage = ''
    state.message = ''
    try {
      const result = await api.lottery.bet({
        lottery: { id: lotteryMeta.value.id, key: lotteryMeta.value.key },
        amount: SUPERLOTTO_BET_AMOUNT,
        slots: readySlots.map((slot) => ({ zoneA: slot.zoneA, zoneB: slot.zoneB as number }))
      })
      state.submitStatus = 'success'
      state.message = result?.message ?? '下注成功'
      state.lastOrderId = String(result?.orderId ?? '')
      wallet.coin = Number(result?.coin ?? wallet.coin)
      const readyAmount = readySlots.length * SUPERLOTTO_BET_AMOUNT
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

export function useSuperlotto() {
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
