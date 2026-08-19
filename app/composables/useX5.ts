import { computed, reactive, watch } from 'vue'
import { LOTTERY, STATUS_TIME, STATUS_ERR_CODE } from '~/config/constants'
import {
  api,
  type X5Current,
  type X5Pool,
  type CreditJackpotState,
  type X5UserBetHistory,
  type LotteryUserBalanceChange,
  type LotteryClaimableIssue,
  type LotteryOpenCodeHistoryItem
} from '~/services/api'
import { judgeX5Bet, X5_PLAY_DEFINITIONS } from '#shared/config/x5-cd'
import {
  x5NumbersOf,
  x5NumberLabel,
  x5SumOf,
  x5SumTailOf,
  X5_BALL_COUNT,
  X5_BALL_NAMES,
  X5_BIG_LINE,
  X5_NUMBERS,
  X5_SUM_BIG_LINE,
  X5_SUM_TAIL_BIG_LINE
} from '#shared/config/x5'
import C_PLAYS from '#shared/config/x5cd/plays'
import { findX5Tab, x5QuotaOf, x5TabOddsOf } from '#shared/config/x5cd/helpers'
import C_OF_PLAYS from '#shared/config/x5of/plays'
import {
  judgeX5OfBet,
  X5_OF_MAX_COMBO,
  X5_OF_PLAY_DEFINITIONS,
  X5_OF_PRIZE_TIERS
} from '#shared/config/x5-of'
import {
  findX5OfTab,
  x5OfComboCodes,
  x5OfComboGroups,
  x5OfComboOf,
  x5OfIsPoolTab,
  x5OfIsSingleTab,
  x5OfItemGroups,
  x5OfQuotaOf,
  x5OfSingleCodes,
  x5OfTabOddsOf
} from '#shared/config/x5of/helpers'

/**
 * 11選5 前端狀態（X5-CD 信用盤／X5-OF 官方盤共用一支）
 *
 * ── 為什麼兩個盤口共用一支 composable ────────────────────
 *   兩邊的期別、倒數、開獎號、彩池都來自伺端的同一份共用狀態
 *   （server/services/game/lottery/bg/x5Shared.ts），前端沒有理由拆成兩份互相打架。
 *   差異只有「注項怎麼選」。
 *
 *   差異只有「注項怎麼選」：
 *     mode = 'cd' → 讀 shared/config/x5cd（4 分頁 112 注項）
 *     mode = 'of' → 讀 shared/config/x5of（8 玩法 54 分頁）
 *
 * ── 官方盤的三種選號型態 ────────────────────────────────
 *   單選分頁（combo = null：定位膽／不定位／趣味玩法）→ of.items（注碼 → 各自金額）
 *   單式分頁（combo.mode = 'single'）→ 同樣走 of.items，注碼由 x5OfSingleCodes() 列出來讓玩家選
 *   展開型分頁（direct / group / any / dantuo）→ of.picks，送單前才用 x5OfComboCodes() 展開
 *   ⚠️ dantuo 的 picks[0] = 膽碼、picks[1] = 拖碼，且兩邊不可同號（選一邊會清掉另一邊）
 *
 * ⚠️ state 是 module 級單例（與 useSsc / useK3 相同做法），
 *    切換盤口時務必呼叫 actions.setMode() 重置選取，否則會把 CD 的注項帶進 OF。
 */

export type X5Mode = 'cd' | 'of'

/** 看板注項（由 config tabGroup.groupList 複製而來，select / coin 為前端選取狀態） */
export type X5SelectItem = {
  playId: string | number
  name: string | number
  odds?: number
  coin?: string | number
  select?: boolean
}

type ConfigPlay = { key?: string; name?: string; list?: any[] }

const cdPlays = C_PLAYS as ConfigPlay[]
const ofPlays = C_OF_PLAYS as ConfigPlay[]

/** 兩面分頁可選的四個面（順序即看板顯示順序） */
const SIDE_OPTIONS = ['大', '小', '單', '雙'] as const

// ── Module-level singletons ────────────────────────────────────────────────
const state = reactive({
  mode: 'cd' as X5Mode,
  /** 信用盤：當前玩法（ball / liangmian / longhu / quan5） */
  select: String(cdPlays[0]?.key ?? ''),
  selectTabId: Number(cdPlays[0]?.list?.[0]?.tabId ?? 0),
  selectTabName: String(cdPlays[0]?.list?.[0]?.tabName ?? ''),
  /** 投注金額：點注項時套用這個值，也可在看板逐項改 */
  amount: 10 as number,
  fetchStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',
  submitStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',
  message: '' as string,
  errorMessage: '' as string,
  lastOrderId: '' as string
})

const current = reactive({
  runtime: null as X5Current | null,
  /** 當期自己的注單（下注成功後本地追加，開獎後由 user-record 覆蓋） */
  detail: [] as Array<{ orderId: string; betCode: string[]; coin: number; odds?: number; time: string }>
})

const pool = reactive<X5Pool>({ issue: '', base: 0, carry: 0, issuePool: 0, distributable: 0 })

/**
 * 爆池（與上面的 pool 是**兩個不同的池**）
 *   pool         —— 共用彩池，官方盤直選類（階段 2）要吃的
 *   creditJackpot—— 爆池，兩個盤口共吃一池、也一起分配
 */
const creditJackpot = reactive<CreditJackpotState>({
  issue: '',
  currentIssueJackpot: 0,
  carryJackpot: 0,
  distributable: 0,
  rakeRatio: 0,
  payoutRatio: 0,
  minPool: 0,
  hitLabel: '',
  hitRate: 0,
  lastHit: null
})

const select = reactive({
  items: [] as X5SelectItem[],
  pool: [] as X5SelectItem[],
  show: true,
  resetToken: 0
})

/**
 * 官方盤（x5of）的選號狀態
 *
 * 兩種形狀：
 *   items —— 單選分頁與單式分頁：注碼 → 各自金額
 *   picks —— 展開型分頁：picks[格] = 該格選的號碼；dantuo 的 0 = 膽碼、1 = 拖碼
 */
const of = reactive({
  play: String(ofPlays[0]?.key ?? ''),
  tabId: Number(ofPlays[0]?.list?.[0]?.tabId ?? 0),
  tabName: String(ofPlays[0]?.list?.[0]?.tabName ?? ''),
  items: [] as Array<{ code: string; odds: number; coin: number }>,
  picks: [] as Array<Array<number>>,
  /** 單式分頁的注碼很多（最多 990），畫面分頁顯示 */
  singlePage: 0
})

const wallet = reactive({ userName: '-', userId: '-', coin: 0, currentBets: 0, totalBets: 0 })

const time = reactive({
  syncedAtServerMs: 0,
  syncedAtClientMs: 0,
  nowMs: Date.now(),
  statusEndAt: 0,
  statusRemainSec: 0,
  statusRemainLabel: '00:00'
})

const userRecord = reactive({
  isLoading: false,
  isSubmittingClaim: false,
  errorMessage: '',
  balanceChanges: [] as LotteryUserBalanceChange[],
  betHistory: [] as X5UserBetHistory[],
  claimableIssues: [] as LotteryClaimableIssue[]
})

const openCodeHistory = reactive({
  isLoading: false,
  errorMessage: '',
  list: [] as LotteryOpenCodeHistoryItem[]
})

// ── Computed：共用 ─────────────────────────────────────────────────────────
const isCd = computed(() => state.mode === 'cd')
/**
 * ⚠️ 階段 1 固定回 X5-CD —— 官方盤還沒登記進 LOTTERY（見 app/config/constants.js 的說明）。
 *    階段 2 改成 `isCd.value ? LOTTERY['X5-CD'] : LOTTERY['X5-OF']`（同 useSsc）。
 */
const lotteryMeta = computed(() => LOTTERY['X5-CD'])
const isOpen = computed(() => String(current.runtime?.currentStatus ?? '') === STATUS_TIME.OPEN)

// ── Computed：信用盤 ───────────────────────────────────────────────────────
/** 玩法清單（直接就是 config，畫面照這個渲染玩法列） */
const playList = computed(() => cdPlays)
/** 當前玩法的分頁清單 */
const groupList = computed(() => playList.value.find((play) => play.key === state.select)?.list ?? [])
/** 當前分頁的群組（看板照這個畫，一群一列標題） */
const tabGroups = computed(() => findX5Tab(state.select, state.selectTabId)?.tabGroup ?? [])
/** 當前分頁限額 */
const currentQuota = computed(() => x5QuotaOf(state.select, state.selectTabId))
/** 已選注項數 */
const selectedCount = computed(() => select.items.filter((item) => Number(item.coin) > 0).length)
/** 本次投注總額 */
const totalAmount = computed(() =>
  Number(select.items.reduce((sum, item) => sum + Number(item.coin ?? 0), 0).toFixed(2))
)
const canSubmit = computed(() =>
  isOpen.value && state.submitStatus !== 'loading' && totalAmount.value > 0
)

// ── Computed：官方盤 ───────────────────────────────────────────────────────
/** 玩法清單（8 個：三碼／二碼／不定位／定位膽／任選複式／任選單式／任選膽拖／趣味玩法） */
const ofPlayList = computed(() => ofPlays.map((play) => ({
  key: String(play.key ?? ''),
  name: String(play.name ?? '')
})))
/** 當前玩法的分頁清單 */
const ofTabList = computed(() => ofPlays.find((play) => play.key === of.play)?.list ?? [])
/** 當前分頁的選號規則；單選分頁回 null */
const ofCombo = computed(() => x5OfComboOf(of.play, of.tabId))
/** 當前分頁是不是單式（注碼列出來直接選） */
const ofIsSingle = computed(() => x5OfIsSingleTab(of.play, of.tabId))
/** 當前分頁是不是走彩池分層（後三直選） */
const ofIsPool = computed(() => x5OfIsPoolTab(of.play, of.tabId))
/** 彩池分頁的獎金分層（畫面顯示用） */
const ofPrizeTiers = computed(() => X5_OF_PRIZE_TIERS)
/** 單選分頁的注項（定位膽／不定位／趣味玩法） */
const ofItemGroups = computed(() => x5OfItemGroups(of.play, of.tabId))
/** 展開型分頁每格可選的號碼 */
const ofComboGroups = computed(() => x5OfComboGroups(of.play, of.tabId))
/** 單式分頁的全部注碼（依 conf 列舉） */
const ofSingleAllCodes = computed(() => (ofIsSingle.value ? x5OfSingleCodes(of.play, of.tabId) : []))
/** 單式分頁一頁顯示幾注（990 個按鈕一次畫出來會拖慢畫面） */
const OF_SINGLE_PAGE_SIZE = 120
const ofSinglePageCount = computed(() =>
  Math.max(1, Math.ceil(ofSingleAllCodes.value.length / OF_SINGLE_PAGE_SIZE))
)
/** 單式分頁當頁的注碼 */
const ofSingleCodes = computed(() => {
  const start = Math.min(of.singlePage, ofSinglePageCount.value - 1) * OF_SINGLE_PAGE_SIZE
  return ofSingleAllCodes.value.slice(start, start + OF_SINGLE_PAGE_SIZE)
})
/** 當前分頁限額 */
const ofQuota = computed(() => x5OfQuotaOf(of.play, of.tabId))
/** 展開後的每一注（注碼字串）；單選／單式分頁回空陣列 */
const ofExpandedCodes = computed(() => {
  if (!ofCombo.value || ofIsSingle.value) return [] as string[]
  return x5OfComboCodes(of.play, of.tabId, of.picks)
})

/** C(n, k) —— 算展開前的注數用 */
function _combinations(n: number, k: number): number {
  if (n < k || k < 0) return 0
  let out = 1
  for (let i = 0; i < k; i++) out = (out * (n - i)) / (i + 1)
  return Math.round(out)
}

/**
 * 展開前的原始注數（不管有沒有超過上限都算得出來）
 * x5OfComboCodes() 超過 X5_OF_MAX_COMBO 會回空陣列，畫面沒辦法從空陣列分辨
 * 「還沒選滿」與「選太多」—— 所以這裡自己算一份給提示用。
 */
const ofRawComboCount = computed(() => {
  const combo = ofCombo.value
  if (!combo || ofIsSingle.value) return 0
  const sizes = of.picks.map((list) => new Set((Array.isArray(list) ? list : []).map(Number)).size)
  if (combo.mode === 'direct') {
    const positions = Number(combo.positions ?? 0)
    if (sizes.length !== positions || sizes.some((n) => n === 0)) return 0
    // 只是估上界（沒扣掉重複號碼的組合），夠用來判斷「是不是選太多」
    return sizes.reduce((acc, n) => acc * n, 1)
  }
  const size = Number(combo.size ?? 0)
  if (combo.mode === 'dantuo') {
    const dan = sizes[0] ?? 0
    const tuo = sizes[1] ?? 0
    if (dan < 1 || dan >= size) return 0
    return _combinations(tuo, size - dan)
  }
  return _combinations(sizes[0] ?? 0, size)
})
/** 是否因為超過上限而展不出注碼 */
const ofComboOverflow = computed(() => ofRawComboCount.value > X5_OF_MAX_COMBO)
/**
 * 展開型分頁還不能送單時的提示文案
 * ⚠️ x5OfComboCodes() 不管「沒選滿」或「超過上限」都回空陣列，
 *    所以看板／當前注項／投注鈕不能各自猜原因 —— 一律讀這裡。
 */
const ofComboHint = computed(() => {
  const combo = ofCombo.value
  if (!combo || ofIsSingle.value) return ''
  if (ofComboOverflow.value) return `展開後超過 ${X5_OF_MAX_COMBO} 注，請縮小選號範圍`
  if (ofExpandedCodes.value.length > 0) return ''
  if (combo.mode === 'direct') return `請為每一個位置都至少選一個號碼（共 ${combo.positions} 個位置）`
  if (combo.mode === 'dantuo') {
    return `請選 1 ~ ${Number(combo.size ?? 0) - 1} 個膽碼，並選足夠的拖碼補到 ${combo.size} 碼`
  }
  return `請至少選 ${combo.minPick} 個號碼`
})
/** 已選注數：items 型＝有金額的注項數、展開型＝展開後的注數 */
const ofSelectedCount = computed(() => {
  if (ofCombo.value && !ofIsSingle.value) return ofExpandedCodes.value.length
  return of.items.filter((item) => Number(item.coin) > 0).length
})
/** 總投注額：展開型的每一注都用同一個金額（state.amount） */
const ofTotalAmount = computed(() => {
  if (ofCombo.value && !ofIsSingle.value) {
    return Number((ofExpandedCodes.value.length * Number(state.amount || 0)).toFixed(2))
  }
  return Number(of.items.reduce((sum, item) => sum + Number(item.coin ?? 0), 0).toFixed(2))
})
const canSubmitOf = computed(() =>
  isOpen.value && state.submitStatus !== 'loading' && ofSelectedCount.value > 0 && ofTotalAmount.value > 0
)
/** 自動下注可用的注碼池（單選分頁的注項／單式分頁的全部注碼）；展開型回空陣列 */
const ofAutoCodes = computed(() => {
  if (ofIsSingle.value) return ofSingleAllCodes.value
  if (ofCombo.value) return [] as string[]
  return ofItemGroups.value.flatMap((group) => group.items.map((item) => item.name)).filter(Boolean)
})
/**
 * 自動下注的注數上限
 *   items 型 → 該分頁的注碼數
 *   展開型   → **全選**展開的注數，再夾到 X5_OF_MAX_COMBO
 * ⚠️ 不能拿 ofExpandedCodes.length 當上限 —— 那是「使用者目前選了多少」，
 *    自動下注還沒選號會一路算成 0。
 */
const ofAutoMaxCount = computed(() => {
  const combo = ofCombo.value
  if (!combo || ofIsSingle.value) return ofAutoCodes.value.length
  const groups = ofComboGroups.value
  if (groups.length === 0) return 0
  const size = Number(combo.size ?? 0)
  let total = 0
  if (combo.mode === 'direct') {
    // 每位全選 = P(11, 位數)（已扣掉重複號碼的組合）
    total = groups.reduce((acc, _g, idx) => acc * (X5_NUMBERS.length - idx), 1)
  } else if (combo.mode === 'dantuo') {
    // 膽 1 拖全 = C(10, size − 1)
    total = _combinations(X5_NUMBERS.length - 1, size - 1)
  } else {
    total = _combinations(X5_NUMBERS.length, size)
  }
  return Math.max(0, Math.min(total, X5_OF_MAX_COMBO))
})

// ── Helpers ────────────────────────────────────────────────────────────────
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
  time.nowMs = time.syncedAtServerMs <= 0 || time.syncedAtClientMs <= 0
    ? Date.now()
    : time.syncedAtServerMs + (Date.now() - time.syncedAtClientMs)
  _updateStatusRemain()
}

/**
 * 重算「當前注項」
 * 與 pcv2 的 car.getSelectedItems() 同一條：isactive || money > 0
 * —— 只填金額不點選也算選中
 */
function _syncSelectItems() {
  select.items = select.pool.filter((item) => Boolean(item.select) || Number(item.coin) > 0)
}

function _shuffle<T>(list: T[]): T[] {
  const items = [...list]
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = items[i] as T
    items[i] = items[j] as T
    items[j] = tmp
  }
  return items
}

/** 該分頁的展開型選號有幾格（dantuo 固定 2 格：膽／拖） */
function _ofPickSlots(): number {
  const combo = x5OfComboOf(of.play, of.tabId)
  if (!combo || combo.mode === 'single') return 0
  if (combo.mode === 'direct') return Number(combo.positions ?? 0)
  if (combo.mode === 'dantuo') return 2
  return 1
}

/** 把展開型的 picks 重設成「每格一個空陣列」 */
function _resetOfPicks() {
  of.picks = Array.from({ length: _ofPickSlots() }, () => [] as number[])
}

/** 某一格可選的號碼 */
function _ofPickOptions(pos: number): number[] {
  const group = x5OfComboGroups(of.play, of.tabId).find((item) => item.pos === Number(pos))
  return group ? [...group.digits] : []
}

/**
 * 逐步加寬每一格，直到展開注數 ≥ size
 * ⚠️ 加太寬會超過 X5_OF_MAX_COMBO（x5OfComboCodes 會回空陣列），
 *    所以一旦展不出來就停在上一組還展得出來的選擇 —— 寧可少於 size，也不要整筆被伺端拒單。
 */
function _widenOfPicks(pools: number[][], size: number): number[][] | null {
  const combo = x5OfComboOf(of.play, of.tabId)
  if (!combo) return null
  const isDantuo = combo.mode === 'dantuo'
  const target = Number(combo.size ?? 0)
  const start = isDantuo ? 1 : Math.max(1, Number(combo.minPick ?? 1))
  const maxTake = Math.max(...pools.map((list) => list.length), 0)
  let best: number[][] | null = null
  for (let take = start; take <= maxTake; take++) {
    // 膽拖：膽碼固定 1 個（多了會壓縮注數），只加寬拖碼
    const picks = isDantuo
      ? [pools[0]!.slice(0, 1), pools[1]!.filter((n) => n !== pools[0]![0]).slice(0, Math.max(target - 1, take))]
      : pools.map((list) => list.slice(0, take))
    const codes = x5OfComboCodes(of.play, of.tabId, picks)
    if (codes.length === 0) {
      if (best) break
      continue
    }
    best = picks
    if (codes.length >= size) break
  }
  return best
}

// 切換分頁／玩法時把金額夾回新分頁限額（超限會被伺端整筆拒單）
watch(() => [state.select, state.selectTabId], () => {
  const quota = currentQuota.value
  state.amount = Math.min(quota.item.max, Math.max(quota.item.min, Math.trunc(Number(state.amount) || 0)))
})
// 官方盤同理
watch(() => [of.play, of.tabId], () => {
  if (isCd.value) return
  const quota = ofQuota.value
  state.amount = Math.min(quota.item.max, Math.max(quota.item.min, Math.trunc(Number(state.amount) || 0)))
})

/**
 * 使用者名稱／ID 跟著 useAuth 的 user 走
 * ⚠️ auth 是非同步載入（/api/me），fetch.userInfo() 跑得早會拿到 null → 卡片顯示 Guest / -，
 *    所以這裡用 watch 補：auth 一到就寫進 wallet（餘額仍以 userInfo API 為準）
 */
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
  /** 切換盤口：注項語意不同，必須清掉選取與上一盤的紀錄 */
  setMode: (mode: X5Mode) => {
    if (state.mode === mode) return
    state.mode = mode
    _actions.clearSelect()
    _actions.clearOf()
    /*
     * 伺端本來就分開存（X5-CD 用 user.x5Record、X5-OF 用 user.x5OfRecord），
     * 但這個 composable 是 module 級單例，userRecord / current.detail 只有一份 ——
     * 不清的話，從 11x5-cd 走到 11x5-of 的那幾百毫秒（新的 userRecordAll 還沒回來），
     * 下注紀錄與當期注單會顯示「上一個盤口」的內容。
     */
    userRecord.balanceChanges = []
    userRecord.betHistory = []
    userRecord.claimableIssues = []
    userRecord.errorMessage = ''
    current.detail = []
    openCodeHistory.list = []
  },

  // ── 官方盤 ──────────────────────────────────────────────────────────────
  /** 切換玩法：分頁指回第一個並清掉選取 */
  setOfPlay: (playKey: string) => {
    if (of.play === playKey) return
    of.play = playKey
    const firstTab = ofPlays.find((play) => play.key === playKey)?.list?.[0]
    of.tabId = Number(firstTab?.tabId ?? 0)
    of.tabName = String(firstTab?.tabName ?? '')
    _actions.clearOf()
  },
  setOfTab: (tabId: number | string) => {
    const tab = findX5OfTab(of.play, tabId)
    if (!tab) return
    of.tabId = Number(tab.tabId)
    of.tabName = String(tab.tabName ?? '')
    _actions.clearOf()
  },
  /** 單選／單式分頁：點注碼切換選取，選取時套用投注金額 */
  toggleOfItem: (code: string) => {
    const key = String(code ?? '').trim()
    if (!key) return
    const idx = of.items.findIndex((item) => item.code === key)
    if (idx >= 0) {
      of.items.splice(idx, 1)
      return
    }
    const quota = x5OfQuotaOf(of.play, of.tabId).item
    of.items.push({
      code: key,
      odds: x5OfTabOddsOf(of.play, of.tabId, key),
      coin: Math.min(quota.max, Math.max(quota.min, Math.trunc(Number(state.amount) || 0)))
    })
  },
  /** 單選／單式分頁：逐項改金額（0 視為取消該注） */
  setOfItemCoin: (code: string, coin: number) => {
    const item = of.items.find((row) => row.code === String(code))
    if (!item) return
    const quota = x5OfQuotaOf(of.play, of.tabId).item
    item.coin = Math.min(quota.max, Math.max(0, Math.trunc(Number(coin) || 0)))
  },
  /** 該注碼是否已選（看板標選中用） */
  isOfItemSelected: (code: string) => of.items.some((item) => item.code === String(code)),
  /** 單式分頁翻頁 */
  setOfSinglePage: (page: number) => {
    const max = ofSinglePageCount.value - 1
    of.singlePage = Math.max(0, Math.min(Math.trunc(Number(page) || 0), max))
  },
  /**
   * 展開型分頁：切換第 pos 格的某個號碼
   *
   * ⚠️ 膽拖的兩格**不可同號** —— 選為膽碼就要從拖碼移除（反之亦然），
   *    來源 select_num_tool.js:85-88 也是這個行為。
   * ⚠️ 膽碼數量上限為 size − 1（膽碼填滿就沒有拖的意義），超過時捨去最早選的那個，
   *    同樣照來源（select_num_tool.js:79-81 的 dan.shift()）。
   */
  toggleOfPick: (pos: number, value: number) => {
    const combo = x5OfComboOf(of.play, of.tabId)
    if (!combo || combo.mode === 'single') return
    const slots = _ofPickSlots()
    const idx = Math.trunc(Number(pos))
    if (!(idx >= 0 && idx < slots)) return
    if (of.picks.length !== slots) _resetOfPicks()
    const num = Math.trunc(Number(value))
    if (!_ofPickOptions(idx).includes(num)) return

    const list = of.picks[idx] as number[]
    const at = list.indexOf(num)
    if (at >= 0) {
      list.splice(at, 1)
      return
    }
    if (combo.mode === 'dantuo') {
      const other = of.picks[1 - idx] as number[]
      const otherAt = other.indexOf(num)
      // 同號不可兩邊都選：先從另一格移除
      if (otherAt >= 0) other.splice(otherAt, 1)
      const danLimit = Number(combo.size ?? 0) - 1
      if (idx === 0 && list.length >= danLimit && danLimit > 0) list.shift()
    }
    list.push(num)
    list.sort((a, b) => a - b)
  },
  /** 展開型分頁：某一格全選 / 全清 */
  toggleOfPickAll: (pos: number) => {
    const slots = _ofPickSlots()
    const idx = Math.trunc(Number(pos))
    if (!(idx >= 0 && idx < slots)) return
    if (of.picks.length !== slots) _resetOfPicks()
    const options = _ofPickOptions(idx)
    const list = of.picks[idx] as number[]
    if (list.length === options.length) {
      of.picks[idx] = []
      return
    }
    const combo = x5OfComboOf(of.play, of.tabId)
    if (combo?.mode === 'dantuo') {
      // 膽拖全選只對拖碼有意義；且要排除已選為膽碼的號碼
      const other = of.picks[1 - idx] as number[]
      of.picks[idx] = options.filter((num) => !other.includes(num))
      return
    }
    of.picks[idx] = [...options]
  },
  /** 該號碼在該格是否已選（看板標選中用） */
  isOfPickSelected: (pos: number, value: number) =>
    (of.picks[Math.trunc(Number(pos))] ?? []).includes(Math.trunc(Number(value))),
  /**
   * 官方盤隨機選號（count 一律當「目標注數」）
   *   items 型 —— 從該分頁的注碼隨機挑 count 個（正好 count 注）
   *   展開型   —— 每格逐步多挑一個，挑到展開後注數 ≥ count 為止
   * @returns 實際選出的注數
   */
  randomOfSelect: (count: number) => {
    const size = Math.max(1, Math.trunc(Number(count) || 1))
    _actions.clearOf()
    const combo = x5OfComboOf(of.play, of.tabId)
    if (!combo || combo.mode === 'single') {
      const codes = ofAutoCodes.value
      _shuffle(codes).slice(0, Math.min(size, codes.length)).forEach((code) => _actions.toggleOfItem(code))
      return of.items.length
    }
    const pools = Array.from({ length: _ofPickSlots() }, (_, pos) => _shuffle(_ofPickOptions(pos)))
    const picks = _widenOfPicks(pools, size)
    if (!picks) return 0
    of.picks = picks.map((list) => [...list].sort((a, b) => a - b))
    return x5OfComboCodes(of.play, of.tabId, of.picks).length
  },
  /** 取注碼賠率（依當前分頁的 rtp 即時推算；彩池分頁回 0） */
  ofOddsOf: (code: string) => x5OfTabOddsOf(of.play, of.tabId, String(code ?? '')),
  /** 官方盤注碼照某組開獎會不會中 */
  judgeOfItem: (betCode: string, openCode: string[], odds = 0) => judgeX5OfBet(betCode, openCode, 1, odds),
  clearOf: () => {
    of.items = []
    of.singlePage = 0
    _resetOfPicks()
  },

  // ── 信用盤 ──────────────────────────────────────────────────────────────
  /** 切換玩法：分頁指回該玩法第一個 */
  setPlay: (playKey: string) => {
    const play = cdPlays.find((item) => item.key === playKey)
    const firstTab = play?.list?.[0]
    state.select = playKey
    if (firstTab) {
      state.selectTabId = Number(firstTab.tabId)
      state.selectTabName = String(firstTab.tabName)
    }
    select.items = []
    select.pool = []
    // 看板的 layout 是 computed，清掉 pool 後要 bump 讓它重新登記
    select.resetToken += 1
  },
  setTab: (tabId: number | string) => {
    const tab = findX5Tab(state.select, tabId)
    if (!tab) return
    state.selectTabId = Number(tab.tabId)
    state.selectTabName = String(tab.tabName)
    select.items = []
    select.pool = []
    select.resetToken += 1
  },
  /** 看板初始化時登記當前分頁所有注項（同一批 reactive 物件，改 select / coin 會反映到畫面） */
  registerSelectPool: (items: X5SelectItem[]) => {
    select.pool = Array.isArray(items) ? items : []
  },
  syncSelectItems: () => { _syncSelectItems() },
  /** 點注項：切換選取，選取時套用投注金額 */
  toggleItem: (playId: string | number) => {
    const item = select.pool.find((option) => String(option.playId) === String(playId))
    if (!item) return
    item.select = !item.select
    item.coin = item.select ? Math.max(0, Math.trunc(Number(state.amount) || 0)) : 0
    _syncSelectItems()
  },
  /** 設定投注金額，並同步已選注項 */
  setAmount: (money: number) => {
    const coin = Math.max(0, Math.trunc(Number(money) || 0))
    state.amount = coin
    select.pool.forEach((item) => { if (item.select) item.coin = coin })
    _syncSelectItems()
  },
  /** 隨機選 count 個注項 */
  randomSelect: (count: number) => {
    if (select.pool.length === 0) return 0
    const size = Math.max(1, Math.min(Math.trunc(Number(count) || 1), select.pool.length))
    const pickedIds = new Set(_shuffle(select.pool).slice(0, size).map((item) => String(item.playId)))
    const coin = state.amount
    select.pool.forEach((item) => {
      item.select = pickedIds.has(String(item.playId))
      item.coin = item.select ? Math.max(0, Math.trunc(Number(coin) || 0)) : 0
    })
    _syncSelectItems()
    return pickedIds.size
  },
  clearSelect: () => {
    select.pool.forEach((item) => { item.select = false; item.coin = 0 })
    select.items = []
  },

  // ── 顯示輔助 ────────────────────────────────────────────────────────────
  /** 注項照某組開獎會不會中（畫面標示用，與結算共用同一支判定） */
  judgeItem: (betCode: string, openCode: string[], odds = 0) => judgeX5Bet(betCode, openCode, 1, odds),
  /** 該期開獎的總和（15 ~ 45） */
  sumOf: (openCode: string[]) => {
    const nums = x5NumbersOf(openCode)
    return nums ? x5SumOf(nums) : 0
  },
  /** 該期總和的尾數（0 ~ 9；尾大／尾小用） */
  sumTailOf: (openCode: string[]) => {
    const nums = x5NumbersOf(openCode)
    return nums ? x5SumTailOf(nums) : 0
  },
  /** 開獎號轉成 5 個號碼；格式不合（含有重複）回空陣列 */
  numbersOf: (openCode: string[]) => x5NumbersOf(openCode) ?? [],
  /**
   * 注碼的顯示名稱
   * 11選5 的注碼本身就自帶前綴（第一球07、總和尾大、龍虎12龍、全中07），直接顯示就看得懂。
   */
  labelOf: (betCode: string | number) => String(betCode ?? ''),
  /** 號碼 → 補零兩位的顯示字串（01 ~ 11） */
  numberLabelOf: (num: number | string) => x5NumberLabel(Number(num)),
  /** 球位索引（0 起算）→ 球位名稱（第一球…） */
  ballNameOf: (index: number) => String(X5_BALL_NAMES[Number(index)] ?? '')
}

// ── Fetch ──────────────────────────────────────────────────────────────────
const fetch = {
  refreshCurrentInfo: async () => {
    try {
      const result = isCd.value ? await api.lottery.currentX5Cd() : await api.lottery.currentX5Of()
      if (!result) return
      current.runtime = result
      time.syncedAtServerMs = Date.now()
      time.syncedAtClientMs = Date.now()
      time.statusEndAt = Number(result.statusEndAt ?? 0)
      Object.assign(pool, result.pool ?? {})
      _updateStatusRemain()
    } catch (error) {
      state.errorMessage = error instanceof Error ? error.message : '取得當期資訊失敗'
    }
  },
  /** 爆池狀態（兩個盤口共吃一池，兩支路由回同一份） */
  creditJackpot: async () => {
    try {
      Object.assign(creditJackpot, isCd.value
        ? await api.lottery.jackpotX5Cd()
        : await api.lottery.jackpotX5Of())
    } catch {
      // 爆池只是看板附加資訊，取不到就維持舊值，不要蓋掉主要流程的錯誤訊息
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
      const res = isCd.value ? await api.lottery.userRecordX5Cd() : await api.lottery.userRecordX5Of()
      userRecord.balanceChanges = res?.balanceChanges ?? []
      userRecord.betHistory = res?.betHistory ?? []
      userRecord.claimableIssues = res?.claimableIssues ?? []
      Object.assign(pool, res?.pool ?? {})
    } catch (error) {
      userRecord.errorMessage = error instanceof Error ? error.message : '取得紀錄失敗'
    } finally {
      userRecord.isLoading = false
    }
  },
  openCodeHistoryAll: async () => {
    openCodeHistory.isLoading = true
    try {
      const res = isCd.value
        ? await api.lottery.openCodeHistoryX5Cd()
        : await api.lottery.openCodeHistoryX5Of()
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
      const res = isCd.value ? await api.lottery.claimOneIssueX5Cd() : await api.lottery.claimOneIssueX5Of()
      if (res?.ok) {
        wallet.coin = Number(res.coin ?? wallet.coin)
        await fetch.userRecordAll()
      }
      return res
    } finally {
      userRecord.isSubmittingClaim = false
    }
  },
  /** 信用盤投注：以當前選取的注項送單 */
  bets: async () => {
    const betItems = select.items.filter((item) => Number(item.coin) > 0)
    if (betItems.length === 0) {
      state.message = '請先選擇注項並填入金額'
      return { ok: false, message: state.message }
    }
    return fetch.submit(
      [{
        playKey: state.select,
        playTypeName: state.selectTabName,
        selectTabId: state.selectTabId,
        playList: betItems.map((item) => ({
          playId: item.playId,
          selectTabId: state.selectTabId,
          label: String(item.name),
          amount: Number(item.coin)
        }))
      }],
      totalAmount.value
    )
  },
  /**
   * 信用盤自動投注：從當前分頁的注項池隨機取 count 項，各下 amount 元
   * 直接組 payload 送單，不經由 select.items —— 這樣不會覆蓋使用者手動填的注項。
   */
  autoBets: async ({ count, amount }: { count: number; amount: number }) => {
    if (select.pool.length === 0) return { ok: false, message: '注項尚未載入', count: 0, amount: 0 }
    const coin = Math.max(0, Math.trunc(Number(amount) || 0))
    if (!(coin > 0)) return { ok: false, message: '請填入投注金額', count: 0, amount: 0 }
    const size = Math.max(1, Math.min(Math.trunc(Number(count) || 1), select.pool.length))
    const picked = _shuffle(select.pool).slice(0, size)

    const result = await fetch.submit(
      [{
        playKey: state.select,
        playTypeName: state.selectTabName,
        selectTabId: state.selectTabId,
        playList: picked.map((item) => ({
          playId: item.playId,
          selectTabId: state.selectTabId,
          label: String(item.name),
          amount: coin
        }))
      }],
      coin * size
    )
    return { ...result, count: size, amount: coin * size }
  },
  /**
   * 官方盤投注
   *
   * 三種選號型態，注碼一律是字串：
   *   單選分頁（定位膽／不定位／趣味玩法）→ of.items（各自金額）
   *   單式分頁                            → 同上，注碼是從列舉清單挑的
   *   展開型分頁                          → x5OfComboCodes() 展開後一注一碼，共用 state.amount
   * ⚠️ 注碼與賠率伺端都會重新驗一次，前端送的只是意圖。
   */
  betsOf: async () => {
    const combo = x5OfComboOf(of.play, of.tabId)
    const quota = x5OfQuotaOf(of.play, of.tabId).item
    const playList: Array<Record<string, unknown>> = []

    if (combo && combo.mode !== 'single') {
      const codes = x5OfComboCodes(of.play, of.tabId, of.picks)
      if (codes.length === 0) {
        state.message = ofComboHint.value || '選號不完整'
        return { ok: false, message: state.message }
      }
      const coin = Math.min(quota.max, Math.max(quota.min, Math.trunc(Number(state.amount) || 0)))
      codes.forEach((code) => playList.push({ label: code, amount: coin }))
    } else {
      of.items.filter((item) => Number(item.coin) > 0).forEach((item) => {
        playList.push({ label: item.code, amount: Number(item.coin) })
      })
      if (playList.length === 0) {
        state.message = '請先選擇注項並填入金額'
        return { ok: false, message: state.message }
      }
    }

    const total = Number(playList.reduce((sum, row) => sum + Number(row.amount ?? 0), 0).toFixed(2))
    const result = await fetch.submit(
      [{ playKey: of.play, playTypeName: of.tabName, selectTabId: of.tabId, playList }],
      total
    )
    if (result.ok) _actions.clearOf()
    return result
  },
  /**
   * 官方盤自動投注
   *
   * 與信用盤的 autoBets 同一個原則：直接組 payload 送單，不動使用者手動選的注項。
   *   items 型 → 從該分頁的注碼隨機取 count 個
   *   展開型   → 每格隨機挑，展開到注數 ≥ count（不衝破 X5_OF_MAX_COMBO）
   */
  autoBetsOf: async ({ count, amount }: { count: number; amount: number }) => {
    const coin = Math.max(0, Math.trunc(Number(amount) || 0))
    if (!(coin > 0)) return { ok: false, message: '請填入投注金額', count: 0, amount: 0 }
    const size = Math.max(1, Math.trunc(Number(count) || 1))
    const combo = x5OfComboOf(of.play, of.tabId)
    const playList: Array<Record<string, unknown>> = []

    if (combo && combo.mode !== 'single') {
      const pools = Array.from({ length: _ofPickSlots() }, (_, pos) => _shuffle(_ofPickOptions(pos)))
      const picks = _widenOfPicks(pools, size)
      const codes = picks ? x5OfComboCodes(of.play, of.tabId, picks) : []
      if (codes.length === 0) return { ok: false, message: '此分頁無法自動選號', count: 0, amount: 0 }
      codes.forEach((code) => playList.push({ label: code, amount: coin }))
    } else {
      const codes = ofAutoCodes.value
      if (codes.length === 0) return { ok: false, message: '注項尚未載入', count: 0, amount: 0 }
      _shuffle(codes).slice(0, Math.min(size, codes.length)).forEach((code) => {
        playList.push({ label: code, amount: coin })
      })
    }

    const total = Number((playList.length * coin).toFixed(2))
    const result = await fetch.submit(
      [{ playKey: of.play, playTypeName: of.tabName, selectTabId: of.tabId, playList }],
      total
    )
    return { ...result, count: playList.length, amount: total }
  },
  /** 共用送單流程（三段狀態 + 餘額／當期資訊刷新） */
  submit: async (groups: any[], amount: number) => {
    if (state.submitStatus === 'loading') return { ok: false, message: '投注處理中' }
    state.submitStatus = 'loading'
    state.errorMessage = ''
    state.message = ''
    try {
      const result = await api.lottery.bet({
        lottery: { id: lotteryMeta.value.id, key: lotteryMeta.value.key },
        amount,
        groups
      } as any)
      state.submitStatus = 'success'
      state.message = String((result as any)?.message ?? '下注成功')
      state.lastOrderId = String((result as any)?.orderId ?? '')
      wallet.coin = Number((result as any)?.coin ?? wallet.coin)
      // 本地追加當期注單，開獎後由 user-record 覆蓋為含結果的版本
      ;((result as any)?.orders ?? []).forEach((row: any) => {
        current.detail.unshift({
          orderId: String(row.order_id ?? ''),
          betCode: Array.isArray(row.bet_code) ? row.bet_code : [],
          coin: Number(row.coin ?? 0),
          odds: Number(row.odds ?? 0),
          time: new Date(Number(row.bet_time ?? Date.now())).toLocaleTimeString('zh-TW')
        })
      })
      if (isCd.value) _actions.clearSelect()
      else _actions.clearOf()
      select.resetToken += 1
      /*
       * 送單成功一律刷新餘額與注單（手動與自動下注兩條路都涵蓋）——
       * 少了這行，自動下注成功後「下注紀錄」要等下一期輪詢才補上，看起來像沒下到。
       */
      await Promise.all([fetch.userInfo(), fetch.userRecordAll()])
      return { ok: true, message: state.message, count: ((result as any)?.orders ?? []).length, amount }
    } catch (error) {
      state.submitStatus = 'error'
      const err = error as any
      state.errorMessage = String(
        err?.data?.message ?? err?.data?.statusMessage ?? (error instanceof Error ? error.message : '下注失敗')
      )
      /*
       * 登入失效：與 6hc / k3 / pk10 / ssc 一致 —— 標記出來讓呼叫端跳出提示並導回登入頁。
       * ⚠️ 業務碼優先，退回 HTTP 401（舊注單或其他來源的未授權回應也要導頁）。
       */
      const isLoginExpired = err?.data?.data?.code === STATUS_ERR_CODE[40001].code
        || err?.data?.statusCode === STATUS_ERR_CODE[40001].httpStatus
        || err?.statusCode === STATUS_ERR_CODE[40001].httpStatus
      return { ok: false, message: state.errorMessage, loginExpired: isLoginExpired }
    }
  },
  initPageData: async () => {
    state.fetchStatus = 'loading'
    await Promise.all([
      fetch.refreshCurrentInfo(), fetch.userInfo(), fetch.openCodeHistoryAll(), fetch.creditJackpot()
    ])
    state.fetchStatus = 'success'
  },
  startPolling: () => {
    if (!clockTimer) clockTimer = setInterval(_tickServerNow, 250)
    if (!pollTimer) {
      pollTimer = setInterval(() => {
        const before = String(current.runtime?.issueLatest ?? '')
        fetch.refreshCurrentInfo().then(() => {
          if (String(current.runtime?.issueLatest ?? '') === before) return
          // 期別換了代表上一期已開獎：注單結果、可領獎金、開獎歷史一起刷新
          current.detail = []
          fetch.userRecordAll()
          fetch.openCodeHistoryAll()
          fetch.creditJackpot()
        })
      }, 3000)
    }
  },
  stopPolling: () => {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }
}

export function useX5() {
  return {
    state,
    current,
    pool,
    creditJackpot,
    select,
    wallet,
    time,
    userRecord,
    openCodeHistory,

    isCd,
    lotteryMeta,
    isOpen,

    /** 信用盤 */
    playList,
    groupList,
    tabGroups,
    currentQuota,
    selectedCount,
    totalAmount,
    canSubmit,

    /** 官方盤 */
    of,
    ofPlayList,
    ofTabList,
    ofCombo,
    ofIsSingle,
    ofIsPool,
    ofPrizeTiers,
    ofItemGroups,
    ofComboGroups,
    ofSingleCodes,
    ofSingleAllCodes,
    ofSinglePageCount,
    ofExpandedCodes,
    ofRawComboCount,
    ofComboOverflow,
    ofComboHint,
    ofQuota,
    ofSelectedCount,
    ofTotalAmount,
    ofAutoCodes,
    ofAutoMaxCount,
    canSubmitOf,
    ofMaxCombo: X5_OF_MAX_COMBO,

    actions: _actions,
    fetch,
    /** 玩法定義（供玩法列表對帳） */
    playDefinitions: X5_PLAY_DEFINITIONS,
    ofPlayDefinitions: X5_OF_PLAY_DEFINITIONS,
    /** 注項賠率查詢（依分頁 rtp 即時推算） */
    oddsOf: x5TabOddsOf,
    /** 常數（元件畫號碼球用） */
    ballCount: X5_BALL_COUNT,
    ballNames: X5_BALL_NAMES,
    numbers: X5_NUMBERS,
    bigLine: X5_BIG_LINE,
    sumBigLine: X5_SUM_BIG_LINE,
    sumTailBigLine: X5_SUM_TAIL_BIG_LINE,
    sideOptions: SIDE_OPTIONS
  }
}
