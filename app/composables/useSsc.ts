import { computed, reactive, watch } from 'vue'
import { LOTTERY, STATUS_TIME, STATUS_ERR_CODE } from '~/config/constants'
import {
  api,
  type SscCurrent,
  type SscPool,
  type CreditJackpotState,
  type SscUserBetHistory,
  type LotteryUserBalanceChange,
  type LotteryClaimableIssue,
  type LotteryOpenCodeHistoryItem
} from '~/services/api'
import { judgeSscBet, SSC_PLAY_DEFINITIONS } from '#shared/config/ssc-cd'
import {
  sscDigitsOf,
  sscSumOf,
  SSC_BALL_COUNT,
  SSC_BALL_NAMES,
  SSC_DIGIT_MAX,
  SSC_PLACE_NAMES
} from '#shared/config/ssc'
import { judgeSscOgBet, SSC_OG_MAX_COMBO } from '#shared/config/sscog'
import C_PLAYS from '#shared/config/ssccd/plays'
import { findSscTab, sscQuotaOf, sscTabOddsOf } from '#shared/config/ssccd/helpers'
import C_OG_PLAYS from '#shared/config/sscog/plays'
import { SSC_OF_PRIZE_TIERS } from '#shared/config/ssc-of'
import {
  findSscOgTab,
  sscOgComboCodes,
  sscOgComboGroups,
  sscOgComboOf,
  sscOgIsPoolTab,
  sscOgQuotaOf,
  sscOgTabOddsOf,
  type SscOgGroupMode
} from '#shared/config/sscog/helpers'

/**
 * 時時彩前端狀態（SSC-CD 信用盤 / SSC-OF 官方盤共用一支）
 *
 * ── 為什麼兩個盤口共用一支 composable ────────────────────
 *   兩邊的期別、倒數、開獎號、彩池都來自伺端的同一份共用狀態
 *   （server/services/game/lottery/bg/sscShared.ts），前端沒有理由拆成兩份互相打架。
 *   差異只有「注項怎麼選」：
 *     mode = 'cd' → 讀 shared/config/ssccd 的注項（7 分頁 152 注項）
 *     mode = 'of' → 讀 shared/config/sscog（11 分頁，10 個是複式）
 *
 * ── 與 usePk10 的差異 ───────────────────────────────────
 *   1. 官方盤**沒有彩池分層玩法** —— 11 個分頁全是固定賠率，
 *      所以沒有 ogIsPool / ofPrizeTiers，注碼也一律是字串（不送 codes 陣列）。
 *   2. 複式有三種形狀（見 og.picks 的註解），展開一律走 sscOgComboCodes()，
 *      它直接吐注碼字串，不像 pk10 還要再轉一次。
 *   3. 開獎是 5 個 0 ~ 9 的號碼且**可重複**，位置型複式不濾重複組合。
 *
 * ⚠️ state 是 module 級單例（與 useK3 / usePk10 相同做法），
 *    切換盤口時務必呼叫 actions.setMode() 重置選取，否則會把 CD 的注項帶進 OF。
 */

export type SscMode = 'cd' | 'of'

/** 看板注項（由 config tabGroup.groupList 複製而來，select / coin 為前端選取狀態） */
export type SscSelectItem = {
  playId: string | number
  name: string | number
  odds?: number
  coin?: string | number
  select?: boolean
  /** 該注項的號碼（1-5球／全5中1 畫號碼球用） */
  digit?: number
  /** 該注項屬於第幾個球位（0 起算） */
  ball?: number
}

type ConfigPlay = { key?: string; name?: string; list?: any[] }

const cdPlays = C_PLAYS as ConfigPlay[]
const ogPlays = C_OG_PLAYS as ConfigPlay[]

/** 大小單雙分頁可選的四個面（順序即看板顯示順序） */
const SIDE_OPTIONS = ['大', '小', '單', '雙'] as const

// ── Module-level singletons ────────────────────────────────────────────────
const state = reactive({
  mode: 'cd' as SscMode,
  /** 信用盤：當前玩法（ball / liangmian / sanpai / quan5 / longhu / douniu / suoha） */
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
  runtime: null as SscCurrent | null,
  /** 當期自己的注單（下注成功後本地追加，開獎後由 user-record 覆蓋） */
  detail: [] as Array<{ orderId: string; betCode: string[]; coin: number; odds?: number; time: string }>
})

const pool = reactive<SscPool>({ issue: '', base: 0, carry: 0, issuePool: 0, distributable: 0 })

/**
 * 信用盤爆池（與上面的 pool 是**兩個不同的池**）
 *   pool         —— 兩個盤口共用，官方盤後三直選分層在吃
 *   creditJackpot—— 信用盤自己的池，開出「後三豹子」那期一次發放
 * ⚠️ 只有信用盤會用到，官方盤不 fetch（省一次請求）。
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
  items: [] as SscSelectItem[],
  pool: [] as SscSelectItem[],
  show: true,
  resetToken: 0
})

/**
 * 官方盤（sscog）的選號狀態
 *
 * 兩種分頁型態：
 *   單選分頁（定位膽）→ items：注碼 → 金額
 *   複式分頁（其餘 10 個）→ picks，送單前才用 sscOgComboCodes() 展開
 *
 * picks 依 combo.mode 有三種形狀：
 *   direct（後二／後三／五星直選）→ picks[pos] = 該位置選的號碼
 *   sides （大小單雙）            → picks[pos] = 該位置選的面（大／小／單／雙）
 *   group （組選／組三／組六）    → 只用 picks[0]，那一組號碼取 k 個
 */
const og = reactive({
  play: String(ogPlays[0]?.key ?? ''),
  tabId: Number(ogPlays[0]?.list?.[0]?.tabId ?? 0),
  tabName: String(ogPlays[0]?.list?.[0]?.tabName ?? ''),
  /** 單選分頁已選注項 */
  items: [] as Array<{ code: string; odds: number; coin: number }>,
  /** 複式分頁的選號（形狀見上方註解） */
  picks: [] as Array<Array<number | string>>
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
  betHistory: [] as SscUserBetHistory[],
  claimableIssues: [] as LotteryClaimableIssue[]
})

const openCodeHistory = reactive({
  isLoading: false,
  errorMessage: '',
  list: [] as LotteryOpenCodeHistoryItem[]
})

// ── Computed：共用 ─────────────────────────────────────────────────────────
const isCd = computed(() => state.mode === 'cd')
const lotteryMeta = computed(() => (isCd.value ? LOTTERY['SSC-CD'] : LOTTERY['SSC-OF']))
const isOpen = computed(() => String(current.runtime?.currentStatus ?? '') === STATUS_TIME.OPEN)

// ── Computed：信用盤 ───────────────────────────────────────────────────────
/** 玩法清單（直接就是 config，畫面照這個渲染玩法列） */
const playList = computed(() => cdPlays)
/** 當前玩法的分頁清單 */
const groupList = computed(() => playList.value.find((play) => play.key === state.select)?.list ?? [])
/** 當前分頁的群組（看板照這個畫，一群一列標題） */
const tabGroups = computed(() => findSscTab(state.select, state.selectTabId)?.tabGroup ?? [])
/** 當前分頁限額 */
const currentQuota = computed(() => sscQuotaOf(state.select, state.selectTabId))
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
/** 玩法清單 */
const ogPlayList = computed(() => ogPlays.map((play) => ({
  key: String(play.key ?? ''),
  name: String(play.name ?? '')
})))
/** 當前玩法的分頁清單 */
const ogTabList = computed(() => ogPlays.find((play) => play.key === og.play)?.list ?? [])
/** 當前分頁的群組（單選分頁＝注項清單） */
const ogGroups = computed(() => findSscOgTab(og.play, og.tabId)?.tabGroup ?? [])
/** 當前分頁的複式規則；單選分頁（定位膽）回 null */
const ogCombo = computed(() => sscOgComboOf(og.play, og.tabId))
/** 複式分頁每個位置可選的號碼／面（digits 與 sides 只會有一邊有值，看 combo.mode） */
const ogComboGroups = computed(() => sscOgComboGroups(og.play, og.tabId))
/**
 * 當前分頁是不是走彩池分層（後三直選）
 *
 * 彩池分頁沒有固定賠率（sscOgTabOddsOf 一律回 0），畫面要改顯示分層說明；
 * 但注碼形狀與複式展開跟其他分頁完全一樣，送單流程不用分岔。
 */
const ogIsPool = computed(() => sscOgIsPoolTab(og.play, og.tabId))
/** 彩池分頁的獎金分層（畫面顯示用） */
const ofPrizeTiers = computed(() => SSC_OF_PRIZE_TIERS)
/** 當前分頁限額 */
const ogQuota = computed(() => sscOgQuotaOf(og.play, og.tabId))
/** 複式展開後的每一注（注碼字串） */
const ogComboCodes = computed(() => {
  if (!ogCombo.value) return [] as string[]
  return sscOgComboCodes(og.play, og.tabId, og.picks)
})
/** C(n, k) —— 組選分頁的注數是組合數 */
function _combinations(n: number, k: number): number {
  if (n < k) return 0
  let out = 1
  for (let i = 0; i < k; i++) out = (out * (n - i)) / (i + 1)
  return Math.round(out)
}

/** 組選分頁一注要幾碼（組六 3 碼、組三與後二組選 2 碼） */
function _groupPickSize(combo: { group?: SscOgGroupMode } | null): number {
  return combo?.group === 'group6' ? 3 : 2
}

/**
 * 展開前的注數（不管有沒有超過上限都算得出來）
 *
 * sscOgComboCodes() 超過 SSC_OG_MAX_COMBO 會回空陣列，畫面沒辦法從空陣列分辨
 * 「還沒選滿」與「選太多」—— 所以這裡自己算一份原始注數給提示用。
 */
const ogRawComboCount = computed(() => {
  const combo = ogCombo.value
  if (!combo) return 0
  const sets = og.picks.map((list) => new Set((Array.isArray(list) ? list : []).map(String)).size)
  if (combo.mode === 'group') return _combinations(sets[0] ?? 0, _groupPickSize(combo))
  const positions = Number(combo.positions ?? 0)
  if (sets.length !== positions || sets.some((n) => n === 0)) return 0
  return sets.reduce((acc, n) => acc * n, 1)
})
/** 是否因為超過上限而展不出注碼（畫面要顯示「請縮小選號範圍」而不是「請選滿」） */
const ogComboOverflow = computed(() => ogRawComboCount.value > SSC_OG_MAX_COMBO)
/**
 * 複式還不能送單時的提示文案（三種 mode + 超過上限共用一份）
 *
 * ⚠️ sscOgComboCodes() 不管是「沒選滿」還是「超過上限」都回空陣列，
 *    所以看板／當前注項／投注鈕不能各自猜原因 —— 一律讀這裡。
 * @returns 可以送單時回空字串
 */
const ogComboHint = computed(() => {
  const combo = ogCombo.value
  if (!combo) return ''
  if (ogComboOverflow.value) return `展開後超過 ${SSC_OG_MAX_COMBO} 注，請縮小選號範圍`
  if (ogComboCodes.value.length > 0) return ''
  return combo.mode === 'group'
    ? `請至少選 ${combo.minPick} 個號碼`
    : `請為每一個位置都至少選一個號碼（共 ${combo.positions} 個位置）`
})
/** 已選注數：單選＝有金額的注項數、複式＝展開後的注數 */
const ogSelectedCount = computed(() =>
  ogCombo.value ? ogComboCodes.value.length : og.items.filter((item) => Number(item.coin) > 0).length
)
/** 總投注額：複式的每一注都用同一個金額（state.amount） */
const ogTotalAmount = computed(() => {
  if (ogCombo.value) return Number((ogComboCodes.value.length * Number(state.amount || 0)).toFixed(2))
  return Number(og.items.reduce((sum, item) => sum + Number(item.coin ?? 0), 0).toFixed(2))
})
const canSubmitOg = computed(() =>
  isOpen.value && state.submitStatus !== 'loading' && ogSelectedCount.value > 0 && ogTotalAmount.value > 0
)
/** 單選分頁（定位膽）的注碼清單；複式分頁回空陣列（那邊的注碼是展開出來的） */
const ogAutoCodes = computed(() => {
  if (ogCombo.value) return [] as string[]
  return (ogGroups.value as any[])
    .flatMap((group) => (group.groupList ?? []).map((option: any) => String(option?.name ?? '')))
    .filter((code) => code.length > 0)
})
/**
 * 自動下注的注數上限
 *   單選分頁 → 該分頁的注碼數
 *   複式分頁 → **全選**展開的注數，再夾到 SSC_OG_MAX_COMBO
 *
 * ⚠️ 不能拿 ogComboCodes.length 當上限 —— 那是「使用者目前選了多少」，
 *    自動下注根本還沒選號，會一路算成 0 → 上限變成 1 注。
 * ⚠️ 五星直選全選是 100,000 注，一定要夾上限，否則面板會讓人填一個送不出去的數字。
 */
const ogAutoMaxCount = computed(() => {
  const combo = ogCombo.value
  if (!combo) return ogAutoCodes.value.length
  const groups = ogComboGroups.value
  if (groups.length === 0) return 0
  const total = combo.mode === 'group'
    ? _combinations(groups[0]?.digits.length ?? 0, _groupPickSize(combo))
    : groups.reduce((acc, group) => acc * Math.max(group.digits.length, group.sides.length), 1)
  return Math.max(0, Math.min(total, SSC_OG_MAX_COMBO))
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

/** 該分頁的複式有幾組選號格（group 模式只有一組） */
function _ogPickSlots(): number {
  const combo = sscOgComboOf(og.play, og.tabId)
  if (!combo) return 0
  return combo.mode === 'group' ? 1 : Number(combo.positions ?? 0)
}

/** 把複式的 picks 重設成「每個位置一個空陣列」 */
function _resetOgPicks() {
  og.picks = Array.from({ length: _ogPickSlots() }, () => [] as Array<number | string>)
}

/** 某個選號格可選的值（號碼或面） */
function _ogPickOptions(pos: number): Array<number | string> {
  const group = sscOgComboGroups(og.play, og.tabId).find((item) => item.pos === Number(pos))
  if (!group) return []
  return group.sides.length > 0 ? [...group.sides] : [...group.digits]
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

/**
 * 逐步加寬每個選號格，直到展開注數 ≥ size
 *
 * ⚠️ 加太寬會超過 SSC_OG_MAX_COMBO（sscOgComboCodes 會回空陣列），
 *    所以一旦展不出來就停在上一組還展得出來的選擇 —— 寧可少於 size，也不要整筆被伺端拒單。
 * @returns 可用的 picks；完全展不出來回 null
 */
function _widenPicks(pools: Array<Array<number | string>>, size: number): Array<Array<number | string>> | null {
  const combo = sscOgComboOf(og.play, og.tabId)
  if (!combo) return null
  const start = Math.max(1, Number(combo.minPick ?? 1))
  const maxTake = Math.max(...pools.map((list) => list.length), 0)
  let best: Array<Array<number | string>> | null = null
  for (let take = start; take <= maxTake; take++) {
    const picks = pools.map((list) => list.slice(0, take))
    const codes = sscOgComboCodes(og.play, og.tabId, picks)
    if (codes.length === 0) break
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
// 官方盤同理：五星直選的單注上限只有 100，切過去要把金額夾下來
watch(() => [og.play, og.tabId], () => {
  if (isCd.value) return
  const quota = ogQuota.value
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
  /** 切換盤口：注項語意不同，必須清掉選取 */
  setMode: (mode: SscMode) => {
    if (state.mode === mode) return
    state.mode = mode
    _actions.clearSelect()
    _actions.clearOg()
    /*
     * 切盤口要把上一盤的資料清掉。
     *
     * 伺端本來就分開存（SSC-CD 用 user.sscRecord、SSC-OF 用 user.sscOfRecord），
     * 但這個 composable 是 module 級單例，userRecord / current.detail 只有一份 ——
     * 不清的話，從 ssc-cd 走到 ssc-of 的那幾百毫秒（新的 userRecordAll 還沒回來），
     * 下注紀錄與當期注單會顯示「上一個盤口」的內容。
     */
    userRecord.balanceChanges = []
    userRecord.betHistory = []
    userRecord.claimableIssues = []
    userRecord.errorMessage = ''
    current.detail = []
    openCodeHistory.list = []
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
    const tab = findSscTab(state.select, tabId)
    if (!tab) return
    state.selectTabId = Number(tab.tabId)
    state.selectTabName = String(tab.tabName)
    select.items = []
    select.pool = []
    select.resetToken += 1
  },
  /** 看板初始化時登記當前分頁所有注項（同一批 reactive 物件，改 select / coin 會反映到畫面） */
  registerSelectPool: (items: SscSelectItem[]) => {
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

  // ── 官方盤 ──────────────────────────────────────────────────────────────
  /** 切換玩法：分頁指回第一個並清掉選取 */
  setOgPlay: (playKey: string) => {
    if (og.play === playKey) return
    og.play = playKey
    const firstTab = ogPlays.find((play) => play.key === playKey)?.list?.[0]
    og.tabId = Number(firstTab?.tabId ?? 0)
    og.tabName = String(firstTab?.tabName ?? '')
    _actions.clearOg()
  },
  setOgTab: (tabId: number | string) => {
    const tab = findSscOgTab(og.play, tabId)
    if (!tab) return
    og.tabId = Number(tab.tabId)
    og.tabName = String(tab.tabName ?? '')
    _actions.clearOg()
  },
  /** 單選分頁（定位膽）：點注項切換選取，選取時套用投注金額 */
  toggleOgItem: (code: string) => {
    const key = String(code ?? '').trim()
    if (!key) return
    const idx = og.items.findIndex((item) => item.code === key)
    if (idx >= 0) {
      og.items.splice(idx, 1)
      return
    }
    const quota = sscOgQuotaOf(og.play, og.tabId).item
    og.items.push({
      code: key,
      odds: sscOgTabOddsOf(og.play, og.tabId, key),
      coin: Math.min(quota.max, Math.max(quota.min, Math.trunc(Number(state.amount) || 0)))
    })
  },
  /** 單選分頁：逐項改金額（0 視為取消該注） */
  setOgItemCoin: (code: string, coin: number) => {
    const item = og.items.find((row) => row.code === String(code))
    if (!item) return
    const quota = sscOgQuotaOf(og.play, og.tabId).item
    item.coin = Math.min(quota.max, Math.max(0, Math.trunc(Number(coin) || 0)))
  },
  /**
   * 複式分頁：切換第 pos 格的某個號碼／面
   * @param value direct/group 傳號碼（0 ~ 9）、sides 傳面（大／小／單／雙）
   */
  toggleOgPick: (pos: number, value: number | string) => {
    const slots = _ogPickSlots()
    const idx = Math.trunc(Number(pos))
    if (!(idx >= 0 && idx < slots)) return
    if (og.picks.length !== slots) _resetOgPicks()
    const options = _ogPickOptions(idx).map(String)
    const key = String(value)
    if (!options.includes(key)) return
    const list = og.picks[idx] as Array<number | string>
    const at = list.findIndex((item) => String(item) === key)
    if (at >= 0) { list.splice(at, 1); return }
    list.push(typeof value === 'number' ? value : key)
    // 依該格的選項順序排好，注碼才會是遞增的（組選的注碼規則要求遞增）
    list.sort((a, b) => options.indexOf(String(a)) - options.indexOf(String(b)))
  },
  /** 複式分頁：某一格全選 / 全清 */
  toggleOgPickAll: (pos: number) => {
    const slots = _ogPickSlots()
    const idx = Math.trunc(Number(pos))
    if (!(idx >= 0 && idx < slots)) return
    if (og.picks.length !== slots) _resetOgPicks()
    const options = _ogPickOptions(idx)
    const list = og.picks[idx] as Array<number | string>
    og.picks[idx] = list.length === options.length ? [] : [...options]
  },
  /**
   * 官方盤隨機選號（count 一律當「目標注數」）
   *   單選分頁 —— 從該分頁所有注項隨機挑 count 個（正好 count 注）
   *   複式分頁 —— 每格逐步多挑一個，挑到展開後注數 ≥ count 為止
   * ⚠️ 複式的注數是乘積／組合數，不見得剛好等於 count；
   *    也不會為了湊 count 而衝破 SSC_OG_MAX_COMBO（見 _widenPicks）。
   * @returns 實際選出的注數
   */
  randomOgSelect: (count: number) => {
    const size = Math.max(1, Math.trunc(Number(count) || 1))
    _actions.clearOg()
    const combo = sscOgComboOf(og.play, og.tabId)
    if (!combo) {
      const codes = (ogGroups.value as any[])
        .flatMap((group) => (group.groupList ?? []).map((option: any) => String(option?.name ?? '')))
        .filter((code) => code.length > 0)
      _shuffle(codes).slice(0, Math.min(size, codes.length)).forEach((code) => _actions.toggleOgItem(code))
      return og.items.length
    }
    const pools = Array.from({ length: _ogPickSlots() }, (_, pos) => _shuffle(_ogPickOptions(pos)))
    const picks = _widenPicks(pools, size)
    if (!picks) return 0
    // 每格各自排回選項順序（組選的注碼要遞增）
    og.picks = picks.map((list, pos) => {
      const options = _ogPickOptions(pos).map(String)
      return [...list].sort((a, b) => options.indexOf(String(a)) - options.indexOf(String(b)))
    })
    return sscOgComboCodes(og.play, og.tabId, og.picks).length
  },
  /** 取注碼賠率（依當前玩法／分頁的 rtp 即時推算，看板顯示用） */
  ogOddsOf: (code: string) => sscOgTabOddsOf(og.play, og.tabId, String(code ?? '')),
  clearOg: () => {
    og.items = []
    _resetOgPicks()
  },

  // ── 顯示輔助 ────────────────────────────────────────────────────────────
  /** 信用盤注項照某組開獎會不會中（畫面標示用，與結算共用同一支判定） */
  judgeItem: (betCode: string, openCode: string[], odds = 0) => judgeSscBet(betCode, openCode, 1, odds),
  /** 官方盤注碼照某組開獎會不會中 */
  judgeOgItem: (betCode: string, openCode: string[], odds = 0) => judgeSscOgBet(betCode, openCode, 1, odds),
  /** 該期開獎的總和（0 ~ 45） */
  sumOf: (openCode: string[]) => {
    const digits = sscDigitsOf(openCode)
    return digits ? sscSumOf(digits) : 0
  },
  /** 開獎號轉成 5 個數字；格式不合回空陣列 */
  digitsOf: (openCode: string[]) => sscDigitsOf(openCode) ?? [],
  /**
   * 注碼的顯示名稱
   * 時時彩的注碼本身就自帶前綴（第一球7、總和大、後三組六123、大小單雙後二大單），
   * 直接顯示就看得懂。
   */
  labelOf: (betCode: string | number) => String(betCode ?? ''),
  /** 球位索引（0 起算）→ 球位名稱（第一球…） */
  ballNameOf: (index: number) => String(SSC_BALL_NAMES[Number(index)] ?? ''),
  /** 球位索引（0 起算）→ 位數名稱（萬位…，官方盤習慣用法） */
  placeNameOf: (index: number) => String(SSC_PLACE_NAMES[Number(index)] ?? '')
}

// ── Fetch ──────────────────────────────────────────────────────────────────
const fetch = {
  refreshCurrentInfo: async () => {
    try {
      const result = isCd.value ? await api.lottery.currentSscCd() : await api.lottery.currentSscOf()
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
  /** 信用盤爆池狀態（官方盤不需要，直接跳過） */
  creditJackpot: async () => {
    if (!isCd.value) return
    try {
      Object.assign(creditJackpot, await api.lottery.jackpotSscCd())
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
      const res = isCd.value ? await api.lottery.userRecordSscCd() : await api.lottery.userRecordSscOf()
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
        ? await api.lottery.openCodeHistorySscCd()
        : await api.lottery.openCodeHistorySscOf()
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
      const res = isCd.value ? await api.lottery.claimOneIssueSscCd() : await api.lottery.claimOneIssueSscOf()
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
   * 兩種分頁形狀，但注碼一律是字串（不像 pk10 前三直選要送 codes 陣列）：
   *   單選分頁（定位膽）→ playList: [{ label: 注碼, amount }]
   *   複式分頁          → sscOgComboCodes() 展開後一注一碼
   * ⚠️ 注碼與賠率伺端都會重新驗一次，前端送的只是意圖。
   */
  betsOf: async () => {
    const combo = sscOgComboOf(og.play, og.tabId)
    const quota = sscOgQuotaOf(og.play, og.tabId).item
    const playList: Array<Record<string, unknown>> = []

    if (combo) {
      const codes = sscOgComboCodes(og.play, og.tabId, og.picks)
      if (codes.length === 0) {
        state.message = ogComboHint.value
        return { ok: false, message: state.message }
      }
      const coin = Math.min(quota.max, Math.max(quota.min, Math.trunc(Number(state.amount) || 0)))
      codes.forEach((code) => playList.push({ label: code, amount: coin }))
    } else {
      og.items.filter((item) => Number(item.coin) > 0).forEach((item) => {
        playList.push({ label: item.code, amount: Number(item.coin) })
      })
      if (playList.length === 0) {
        state.message = '請先選擇注項並填入金額'
        return { ok: false, message: state.message }
      }
    }

    const total = Number(playList.reduce((sum, row) => sum + Number(row.amount ?? 0), 0).toFixed(2))
    const result = await fetch.submit(
      [{ playKey: og.play, playTypeName: og.tabName, selectTabId: og.tabId, playList }],
      total
    )
    if (result.ok) _actions.clearOg()
    return result
  },
  /**
   * 官方盤自動投注
   *
   * 與信用盤的 autoBets 同一個原則：直接組 payload 送單，不動使用者手動選的注項。
   *   單選分頁 → 從該分頁注碼隨機取 count 個
   *   複式分頁 → 每格隨機挑，展開到注數 ≥ count（不衝破 SSC_OG_MAX_COMBO）
   */
  autoBetsOf: async ({ count, amount }: { count: number; amount: number }) => {
    const coin = Math.max(0, Math.trunc(Number(amount) || 0))
    if (!(coin > 0)) return { ok: false, message: '請填入投注金額', count: 0, amount: 0 }
    const size = Math.max(1, Math.trunc(Number(count) || 1))
    const combo = sscOgComboOf(og.play, og.tabId)
    const playList: Array<Record<string, unknown>> = []

    if (combo) {
      const pools = Array.from({ length: _ogPickSlots() }, (_, pos) => _shuffle(_ogPickOptions(pos)))
      const picks = _widenPicks(pools, size)
      const codes = picks ? sscOgComboCodes(og.play, og.tabId, picks) : []
      if (codes.length === 0) return { ok: false, message: '此分頁無法自動選號', count: 0, amount: 0 }
      codes.forEach((code) => playList.push({ label: code, amount: coin }))
    } else {
      const codes = (ogGroups.value as any[])
        .flatMap((group) => (group.groupList ?? []).map((option: any) => String(option?.name ?? '')))
        .filter((code) => code.length > 0)
      if (codes.length === 0) return { ok: false, message: '注項尚未載入', count: 0, amount: 0 }
      _shuffle(codes).slice(0, Math.min(size, codes.length)).forEach((code) => {
        playList.push({ label: code, amount: coin })
      })
    }

    const total = Number((playList.length * coin).toFixed(2))
    const result = await fetch.submit(
      [{ playKey: og.play, playTypeName: og.tabName, selectTabId: og.tabId, playList }],
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
      else _actions.clearOg()
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
       * 登入失效：與 6hc / k3 / pk10 一致 —— 標記出來讓呼叫端跳出提示並導回登入頁。
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

export function useSsc() {
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
    og,
    ogPlayList,
    ogTabList,
    ogGroups,
    ogCombo,
    ogComboGroups,
    ogComboCodes,
    ogRawComboCount,
    ogComboOverflow,
    ogComboHint,
    ogIsPool,
    ofPrizeTiers,
    ogQuota,
    ogSelectedCount,
    ogTotalAmount,
    ogAutoCodes,
    ogAutoMaxCount,
    canSubmitOg,
    ogMaxCombo: SSC_OG_MAX_COMBO,

    actions: _actions,
    fetch,
    /** 玩法定義（供玩法列表對帳） */
    playDefinitions: SSC_PLAY_DEFINITIONS,
    /** 注項賠率查詢（依分頁 rtp 即時推算） */
    oddsOf: sscTabOddsOf,
    /** 常數（元件畫號碼球用） */
    ballCount: SSC_BALL_COUNT,
    digitMax: SSC_DIGIT_MAX,
    ballNames: SSC_BALL_NAMES,
    placeNames: SSC_PLACE_NAMES,
    sideOptions: SIDE_OPTIONS
  }
}
