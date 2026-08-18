import { computed, reactive, ref, watch } from 'vue'
import { LOTTERY, SORT, STATUS_TIME } from '~/config/constants'
import { CREDIT_PLAY_DEFINITIONS } from '#shared/config/6hc-cd'
import {
  api,
  type Lottery6hcCurrent,
  type Lottery6hcCdJackpot,
  type Lottery6hcRoadPlay,
  type LotteryClaimableIssue,
  type LotteryOpenCodeHistoryItem,
  type LotteryUserBalanceChange,
  type LotteryUserBetHistory
} from '~/services/api'
import { handle as utHandle } from '~/utils/common'
import { Lottery6hcCreditService } from '~/services/lottery6hcCreditService'

// 玩法看板設定（特碼 / 正碼…），新增玩法只需在 shared/config/cd/index.js 註冊
import C_PLAYS from '#shared/config/cd/plays'
// 賠率與限額讀取層（分頁 settings.quota / 注項 odds / 連碼選號規格）
import { creditComboCount, creditComboOf, creditQuotaOf, creditTiersOf } from '#shared/config/cd/helpers'
import { creditRecommendOf, type CreditRecommend } from '#shared/config/cd/recommend'
import { type CreditAnalyzeDimension } from '#shared/config/cd/analyze'


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
  playKey?: string
  playName?: string
  playTypeName?: string
  tabId?: number
  tabName?: string
}
// 玩法頁號碼球 / 膠囊注項（由 config tabGroup.groupList 複製而來，select / coin 為前端選取狀態）
export type SelectItem = {
  playId: string | number
  name: string | number
  coin?: string | number
  select?: boolean
  /** 連碼：該注的號碼組（如 ['03','15','22']）；其餘玩法不帶，一注只有一個注項 */
  codes?: string[]
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

// ── Module-level singletons (shared across components) ─────────────────────

const state = reactive({
  select: String(C_PLAYS[0]?.key ?? ''),
  selectTabId: Number(C_PLAYS[0]?.list?.[0]?.tabId ?? 0),
  selectTabName: String(C_PLAYS[0]?.list?.[0]?.tabName ?? ''),
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
  detail: [] as CurrentDetailRow[],
  runtime: null as Lottery6hcCurrent | null,
  orderCache: {
    isLoading: false,
    isSuccess: false,
    errorMessage: ''
  }
})
// 球號分析（路珠）：49 顆球 + 相隔期數 / 攪出次數
const road = reactive({
  plays: [] as Lottery6hcRoadPlay[],
  fetchStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',
  errorMessage: '' as string,
})
// 注號分析
const analyze = reactive({
  // 排序模式（預設 / 下注次數(自) / 攪出次數(系) / 相隔期數(系)）
  status: SORT.DEFAULT as string,
  // 分析角度（號碼 / 大小 / 單雙 / 兩面 / 五行 / 生肖 / 尾數）
  // 'number' 為原本的 49 顆球檢視，其餘會把號碼依該角度分組後比較群組統計
  dimension: 'number' as CreditAnalyzeDimension,
})
// 下注紀錄 Dialog（餘額變動表 / 下注紀錄 / 可領獎金）
const userRecord = reactive({
  isLoading: false,
  isSubmittingClaim: false,
  isSuccess: false,
  errorMessage: '',
  balanceChanges: [] as LotteryUserBalanceChange[],
  betHistory: [] as LotteryUserBetHistory[],
  claimableIssues: [] as LotteryClaimableIssue[],
  jackpot: {
    issue: '',
    currentIssueJackpot: 0,
    carryJackpot: 0
  }
})
// 開獎歷史 Dialog
const openCodeHistory = reactive({
  isLoading: false,
  isSuccess: false,
  errorMessage: '',
  list: [] as LotteryOpenCodeHistoryItem[]
})
const wallet = reactive({
  userName: '-' as string,
  userId: '-' as string,
  creditLimit: 0 as number,
  balanceLimit: 0 as number,
  coin: 0 as number,
  currentBets: 0 as number,
  totalBets: 0 as number,
  analysis: '-' as string,
})
const time = reactive({
  syncedAtServerMs: 0,
  syncedAtClientMs: 0,
  nowMs: Date.now(),
  statusEndAt: 0,
  statusRemainSec: 0,
  statusRemainLabel: '00:00',
})
const select = reactive({
  items: [] as SelectItem[],
  pool: [] as SelectItem[], // 當前分頁所有可選注項（由玩法頁 layout 初始化時登記，供隨機選號使用）
  show: true, // 「當前注項」面板顯示開關（預設開啟）
  resetToken: 0, // 下注成功後 +1，通知玩法頁重新 init layout（coin=0 / select=false）
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
  /** 可發放累積池（當期抽水 + 累積滾存，不含展示用池底） */
  distributable: 0 as number,
  /** 最近一次爆池紀錄 */
  lastHit: null as Lottery6hcCdJackpot['lastHit'],
})

const livePool = computed(() => {
  const real = Number((jackpot.currentIssueJackpot + jackpot.carryJackpot).toFixed(2))
  return Number((jackpot.base + real).toFixed(2))
})
// 依目前 select(玩法) 取出該玩法的分頁清單（每個分頁含 tabGroup 注項群組）
const groupList = computed(() => {
  const play = C_PLAYS.find((item) => item.key === state.select)
  return play?.list ?? []
})

// 當前玩法 + 分頁的限額（單注上下限 / 單期上限），前端 clamp 與提示皆讀這份
const currentQuota = computed(() => creditQuotaOf(state.select, state.selectTabId))

// 當前分頁的連碼選號規格（非連碼分頁為 null，看板據此決定用哪一套選取語意）
const currentCombo = computed(() => creditComboOf(state.select, state.selectTabId))
// 當前分頁的命中檔次表（連碼專用，看板顯示賠率用）
const currentTiers = computed(() => creditTiersOf(state.select, state.selectTabId))
// 連碼複式可組出的最大注數（選滿 maxPick 個號）
const comboMaxBets = computed(() =>
  currentCombo.value ? creditComboCount(currentCombo.value.maxPick, currentCombo.value.pick) : 0
)

/** 從已選號碼取出 k 個號的所有組合（字典序，供複式展開） */
function _combinations(codes: string[], pick: number): string[][] {
  const result: string[][] = []
  const walk = (start: number, picked: string[]) => {
    if (picked.length === pick) { result.push([...picked]); return }
    for (let i = start; i < codes.length; i++) {
      picked.push(codes[i] as string)
      walk(i + 1, picked)
      picked.pop()
    }
  }
  if (pick > 0 && codes.length >= pick) walk(0, [])
  return result
}

/**
 * 注項名稱正規化（比對推薦結果與號碼球用）
 * 號碼一律補零成兩位（config 是 '01'，畫面可能給 1），其餘名稱只去空白
 */
function _normalizeBetName(name: string | number): string {
  const text = String(name ?? '').trim()
  return /^\d+$/.test(text) ? text.padStart(2, '0') : text
}

/**
 * 把對沖排序換算成當前分頁的推薦注項（純查詢，不動任何選取狀態）
 * 畫面用它顯示「這個玩法推薦什麼」，selectByRecommend 用它決定要選哪些注項
 */
function _recommendOf(ranked: Array<string | number>): CreditRecommend | null {
  const issue = String(current.runtime?.issueCurrent ?? '')
  return creditRecommendOf({
    playKey: String(state.select),
    tabId: Number(state.selectTabId),
    ranked: Array.isArray(ranked) ? ranked : [],
    // 生肖／五行的號碼表逐年輪轉，推薦必須用該期年份（與結算同一套判定）
    year: Number(issue.slice(0, 4)) || new Date().getFullYear()
  })
}

/**
 * 組合型玩法「一注」的注碼正規化
 * 連碼／全不中… 的注項是數字號碼（補零成兩位、依數值排序）；
 * 合肖／連肖／連尾是生肖或尾數中文名（不可轉數字，依文字排序）
 * 排序是為了讓同一組合有穩定的 key（去重與 playId 都靠它）
 */
function _normalizeComboCodes(names: Array<string | number>): string[] {
  const list = (Array.isArray(names) ? names : []).map((name) => String(name).trim()).filter(Boolean)
  const isNumeric = list.length > 0 && list.every((name) => /^\d+$/.test(name))
  return list
    .map((name) => (isNumeric ? String(Number(name)).padStart(2, '0') : name))
    .sort((a, b) => (isNumeric ? Number(a) - Number(b) : a.localeCompare(b, 'zh-Hant')))
}

/**
 * 依 pool 的 select 狀態重算「當前注項」
 * 一般玩法：一個被選取的注項 = 一注
 * 連碼：被選取的是「號碼」；合肖 / 連肖：被選取的是「生肖」——
 *      兩者都要展開成 C(已選, pick) 個組合，每個組合才是一注
 *      （伺端會逐注重新驗證號碼／生肖組是否合法，前端展開只影響顯示與送單內容）
 */
function _syncSelectItems() {
  const picked = select.pool.filter((item) => Boolean(item.select))
  const combo = currentCombo.value
  if (!combo) {
    select.items = picked
    return
  }
  // 連碼的注項是數字號碼（補零、依數值排序）；合肖 / 連肖是生肖中文名（不可轉數字，依文字排序）
  const codes = _normalizeComboCodes(picked.map((item) => item.name))
  const coin = Math.min(currentQuota.value.item.max, Math.max(currentQuota.value.item.min, Number(state.amount) || 0))
  select.items = _combinations(codes, combo.pick).map((group) => ({
    playId: `${state.selectTabId}-${group.join('-')}`,
    name: group.join('、'),
    codes: group,
    coin,
    select: true,
  }))
}

// 切換分頁 / 玩法時把下注金額夾回新分頁的限額（A 盤 10 元帶進 B 盤最低 100 會被伺端拒單）
watch(() => [state.select, state.selectTabId], () => {
  const quota = currentQuota.value
  const amount = Math.trunc(Number(state.amount) || 0)
  state.amount = Math.min(quota.item.max, Math.max(quota.item.min, amount))
})

// 連碼的每注金額由 state.amount 統一帶（不像其他玩法可逐項輸入），金額變動要重算注項
watch(() => state.amount, () => {
  if (currentCombo.value) _syncSelectItems()
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

const stopOpeningWatch = watch(isOpening, (opening) => {
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

// 開獎中已開出的實際號碼集合（供 Road 高亮使用）
const openingRevealedNumbers = computed(() => {
  const codes = Array.isArray(current.runtime?.openingCode) ? (current.runtime.openingCode as string[]) : []
  const numSet = new Set<number>()
  openingRevealedIndices.value.forEach((idx) => {
    const num = Number(codes[idx])
    if (Number.isFinite(num) && num > 0) numSet.add(num)
  })
  return numSet
})

const creditService = new Lottery6hcCreditService()

// ── 當期注單（本地 IndexedDB，信用盤專屬表 lhc_credit_orders） ───────────────
const lhcDb = useLhcDb('credit')
let orderDetailUnsubscribe: (() => void) | null = null
let orderDetailIssue = ''

function _formatTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '--:--:--'
  const date = new Date(timestamp)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

// 依 play_key 從設定取玩法中文名（如 lianma → 連碼），取不到則退回 key
function _resolvePlayName(playKey?: string): string {
  if (!playKey) return ''
  const def = (CREDIT_PLAY_DEFINITIONS as Array<{ key: string; name: string }>).find((d) => d.key === playKey)
  return def?.name ?? playKey
}

// 依 select_tab_id 從 config 取分頁名（如 2000 → 特碼A、3000 → 正碼A），取不到則回空字串
function _resolveTabName(tabId?: number): string {
  const id = Number(tabId)
  if (!Number.isFinite(id) || id <= 0) return ''
  for (const play of C_PLAYS) {
    const tab = play.list?.find((item) => Number(item.tabId) === id)
    if (tab?.tabName) return String(tab.tabName)
  }
  return ''
}

function _toDetailRows(orders: Order[]): CurrentDetailRow[] {
  return orders.map((order) => ({
    id: String(order.order_id),
    time: _formatTime(order.bet_time),
    bets: Array.isArray(order.bet_code) ? order.bet_code : [],
    coin: Number(order.coin ?? 0),
    betCount: Number(order.bet_count ?? 0) || (Array.isArray(order.bet_code) ? order.bet_code.length : 1),
    status: order.status ?? 'success',
    playKey: order.play_key ?? '',
    playName: _resolvePlayName(order.play_key),
    playTypeName: order.play_type_name ?? '',
    tabId: Number(order.select_tab_id ?? 0),
    tabName: _resolveTabName(order.select_tab_id),
  }))
}

// 下注成功後把回傳訂單存進本地 DB（user_id 一律用前端 userId，確保 watch 對得上）
async function _saveOrders(orders: unknown, userId: string, issue: string) {
  if (!Array.isArray(orders) || orders.length === 0) return
  try {
    await Promise.all(orders.map((raw) => {
      const o = raw as Partial<Order>
      const row: Order = {
        order_id: String(o.order_id ?? ''),
        user_id: userId,
        issue: String(o.issue ?? issue),
        bet_time: Number(o.bet_time ?? Date.now()),
        coin: Number(o.coin ?? 0),
        bet_count: Number(o.bet_count ?? 0) || (Array.isArray(o.bet_code) ? o.bet_code.length : 1),
        bet_code: Array.isArray(o.bet_code) ? o.bet_code : [],
        status: (o.status as Status) ?? 'success',
        play_key: String(o.play_key ?? state.activePlay?.key ?? ''),
        play_type_name: String(o.play_type_name ?? state.selectedTypeName ?? ''),
        select_tab_id: Number(o.select_tab_id ?? state.selectTabId ?? 0),
      }
      return row.order_id ? lhcDb.saveOrder(row) : Promise.resolve(false)
    }))
    await lhcDb.cleanupOrders(userId)
  } catch { /* 快取失敗不影響下注 UX */ }
}

function _stopOrderDetailSync() {
  if (orderDetailUnsubscribe) { orderDetailUnsubscribe(); orderDetailUnsubscribe = null }
  orderDetailIssue = ''
}

// 依 user + issue 監看當期注單；同期已訂閱則略過，換期才重新訂閱
function _startOrderDetailSync(userId: string, issue: string) {
  if (!userId || !issue) return
  if (orderDetailUnsubscribe && orderDetailIssue === issue) return
  _stopOrderDetailSync()
  orderDetailIssue = issue
  orderDetailUnsubscribe = lhcDb.watchOrders({
    userId,
    issue,
    limit: 50,
    onChange: (records) => { current.detail = _toDetailRows(records) },
  })
}

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

// 可隨機投注／選號的注項：優先純數字號碼球，無號碼球時退回全部注項
function _randomBetPool(): SelectItem[] {
  const balls = select.pool.filter((item) => /^\d+$/.test(String(item.name)))
  return balls.length > 0 ? balls : [...select.pool]
}

/**
 * 自動投注可送出的最大注數（超過會被伺端拒單，整期投不進去）
 * 組合型玩法：一注是一組號碼／生肖／尾數，注數上限 = C(maxPick, pick)（與伺端 validateBetQuota 同一條）
 * 其餘玩法：一個注項 = 一注，上限就是注項數
 */
function _autoBetMaxCount(): number {
  const combo = currentCombo.value
  if (combo) return creditComboCount(combo.maxPick, combo.pick)
  return _randomBetPool().length
}

/**
 * 產生自動投注的注項（依當前玩法決定「一注長什麼樣」）
 *
 * ⚠️ 舊版一律「隨機取 count 個注項、每個注項一注」，組合型玩法（連碼／合肖／連肖／連尾／
 *    全不中／中一／特平中）會送出不帶 codes 的單一注項 —— 伺端 _resolveBetCodes 取不到
 *    合法號碼組，整筆被拒單（「每注需選 n 個不重複的號碼」），等於這些玩法根本不支援自動投注。
 *    現在改為：組合型玩法每注隨機組出 pick 個項目，注與注之間不重複。
 */
function _autoBetItems(count: number, amount: number): SelectItem[] {
  const pool = _randomBetPool()
  if (pool.length === 0) return []
  const size = Math.max(1, Math.min(Math.trunc(Number(count) || 1), _autoBetMaxCount()))
  const combo = currentCombo.value
  if (!combo) {
    // 單一注項型：一個注項 = 一注
    return _shuffleBetItems(pool)
      .slice(0, size)
      .map((item) => ({ playId: item.playId, name: item.name, coin: amount }))
  }
  if (pool.length < combo.pick) return []
  // 組合型：每注隨機取 pick 個項目組成一注；用 key 去重避免同一組合重複下注
  const seen = new Set<string>()
  const items: SelectItem[] = []
  // 亂數可能一直撞到重複組合，用 guard 限制嘗試次數（注數上限已由 size 夾住）
  const maxTry = size * 40 + 100
  for (let tried = 0; items.length < size && tried < maxTry; tried++) {
    const codes = _normalizeComboCodes(_shuffleBetItems(pool).slice(0, combo.pick).map((item) => item.name))
    if (codes.length !== combo.pick) continue
    const key = codes.join('-')
    if (seen.has(key)) continue
    seen.add(key)
    items.push({ playId: `${state.selectTabId}-${key}`, name: codes.join('、'), codes, coin: amount })
  }
  return items
}

// Fisher-Yates：回傳打亂後的新陣列（不動原 pool 順序）
function _shuffleBetItems(list: SelectItem[]): SelectItem[] {
  const result = [...list]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = result[i] as SelectItem
    result[i] = result[j] as SelectItem
    result[j] = tmp
  }
  return result
}

function _getBetErrorMessage(error: unknown): string {
  const err = error as any
  // message 優先：statusMessage 是 HTTP reason phrase，h3 會把中文消毒掉
  if (err?.data?.message) return String(err.data.message)
  if (err?.data?.statusMessage) return String(err.data.statusMessage)
  if (error instanceof Error) return error.message
  return '下注失敗，請稍後重試'
}

const fetch = {
  initPageData: async (userId?: string | number | null) => {
    const _userId = utHandle.normalizeUserId(userId)
    orderQuery.userId = _userId
    // await fetch.orderDetailFromCache(normalizedUserId)
    await Promise.all([
      fetch.refreshCurrentInfo(),
      fetch.userInfo(),
      fetch.roadPlays(),
      // fetch.walletState(),
      // fetch.betMeta(),
    ])
    fetch.startJackpotPolling()
  },
  userInfo: async () => {
    const { user } = useAuth()
    wallet.userName = String(user.value?.name || 'Guest')
    wallet.userId = String(user.value?.id || '-')
    try {
      const res = await api.lottery.userInfo(LOTTERY['LHC-CD'].key)
      wallet.coin = Number(res?.coin ?? 0)
      wallet.currentBets = Number(res?.currentBets ?? 0)
      wallet.totalBets = Number(res?.totalBets ?? 0)
      wallet.analysis = String(res?.analysis ?? '-')
    } catch {
      wallet.analysis = '-'
    }
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
      _startOrderDetailSync(_userId, issue)
    }
    return result
  },
  // 球號分析（路珠）
  roadPlays: async () => {
    if (road.fetchStatus === 'loading') return road.plays
    road.fetchStatus = 'loading'
    road.errorMessage = ''
    try {
      const result = await creditService.fetchRoadPlays()
      road.plays = Array.isArray(result?.plays) ? result.plays : []
      road.fetchStatus = 'success'
    } catch (error) {
      road.fetchStatus = 'error'
      road.errorMessage = error instanceof Error ? error.message : '球號分析載入失敗'
    }
    return road.plays
  },
  // 下注紀錄 Dialog：餘額變動表 / 下注紀錄 / 可領獎金
  userDialogRecord: async () => {
    if (userRecord.isLoading) return null
    userRecord.isLoading = true
    userRecord.isSuccess = false
    userRecord.errorMessage = ''
    try {
      const result = await creditService.fetchUserRecord()
      userRecord.balanceChanges = Array.isArray(result?.balanceChanges) ? result.balanceChanges : []
      userRecord.betHistory = Array.isArray(result?.betHistory) ? result.betHistory : []
      userRecord.claimableIssues = Array.isArray(result?.claimableIssues) ? result.claimableIssues : []
      userRecord.jackpot = {
        issue: String(result?.jackpot?.issue ?? ''),
        currentIssueJackpot: Number(result?.jackpot?.currentIssueJackpot ?? 0),
        carryJackpot: Number(result?.jackpot?.carryJackpot ?? 0)
      }
      userRecord.isSuccess = true
      return result
    } catch (error) {
      userRecord.balanceChanges = []
      userRecord.betHistory = []
      userRecord.claimableIssues = []
      userRecord.errorMessage = error instanceof Error ? error.message : '讀取會員紀錄失敗'
      return null
    } finally {
      userRecord.isLoading = false
    }
  },
  // 開獎歷史
  openCodeHistory: async () => {
    if (openCodeHistory.isLoading) return openCodeHistory.list
    openCodeHistory.isLoading = true
    openCodeHistory.isSuccess = false
    openCodeHistory.errorMessage = ''
    try {
      const result = await creditService.fetchOpenCodeHistory()
      openCodeHistory.list = Array.isArray(result?.history) ? result.history : []
      openCodeHistory.isSuccess = true
    } catch (error) {
      openCodeHistory.list = []
      openCodeHistory.errorMessage = error instanceof Error ? error.message : '讀取開獎歷史失敗'
    } finally {
      openCodeHistory.isLoading = false
    }
    return openCodeHistory.list
  },
  // 領取單期中獎獎金（成功後刷新餘額與紀錄）
  claimOneIssue: async () => {
    if (userRecord.isSubmittingClaim) return { ok: false, message: '領獎處理中' }
    userRecord.isSubmittingClaim = true
    userRecord.errorMessage = ''
    try {
      const result = await creditService.submitClaimOneIssue()
      await Promise.all([
        fetch.userInfo(),
        fetch.userDialogRecord()
      ])
      return {
        ok: Boolean(result?.ok),
        message: String(result?.message ?? '領獎完成'),
        issue: String(result?.issue ?? ''),
        amount: Number(result?.amount ?? 0)
      }
    } catch (error) {
      userRecord.errorMessage = error instanceof Error ? error.message : '領獎失敗'
      return { ok: false, message: userRecord.errorMessage }
    } finally {
      userRecord.isSubmittingClaim = false
    }
  },
  refreshCurrentInfo: async () => {
    try {
      const prevStatus = String(current.runtime?.currentStatus ?? '')
      const data = await fetch.currentInfo()
      const nextStatus = String(data?.currentStatus ?? '')
      // 開獎結束 → 重新拉球號分析（相隔期數 / 攪出次數已變動）
      if (prevStatus.includes('開獎中') && !nextStatus.includes('開獎中')) {
        fetch.roadPlays()
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
        jackpot.distributable = Number(result.distributable ?? (Number(result.currentIssueJackpot ?? 0) + Number(result.carryJackpot ?? 0)))
        jackpot.lastHit = result.lastHit ?? null
      } catch { /* silent */ }
    }, 5000)
  },
  stopJackpotPolling: () => {
    if (!jackpotPollTimer) return
    clearInterval(jackpotPollTimer)
    jackpotPollTimer = null
  },
  // 玩法頁投注：以當前選取的注項（每注各自 coin）送單，成功後清空選取
  bets: async () => {
    const betItems = (select.items as SelectItem[]).filter((item) => Number(item?.coin) > 0)
    if (betItems.length === 0) {
      state.message = '請先選擇注項並填入金額'
      return { ok: false, message: state.message }
    }
    return fetch.submitBetItems(betItems, { clearSelection: true })
  },
  /**
   * 自動投注（不動使用者手動選取的注項）
   *
   * 依當前玩法決定「一注長什麼樣」：
   *   單一注項型 —— 一個注項 = 一注（特碼號碼、五行、一肖、七碼顆數、一肖量…）
   *   組合型     —— 一注是 pick 個號碼／生肖／尾數（連碼、合肖、連肖、連尾、全不中、中一、特平中）
   *
   * @param input.mode   random = 隨機組注（預設）；recommend = 押號碼推薦換算出的注項
   * @param input.ranked recommend 模式必填：對沖排序（全部 49 個號碼）
   */
  autoBets: async (input: {
    count: number
    amount: number
    mode?: 'random' | 'recommend'
    ranked?: Array<string | number>
  }) => {
    const amount = Math.trunc(Number(input?.amount) || 0)
    if (amount <= 0) return { ok: false, message: '自動投注金額需大於 0' }
    if (select.pool.length === 0) return { ok: false, message: '目前分頁沒有可自動投注的注項' }
    if (input?.mode === 'recommend') {
      const recommend = _recommendOf(input.ranked ?? [])
      const wanted = recommend?.codes.length ? recommend.codes : recommend?.names ?? []
      if (wanted.length === 0) return { ok: false, message: '此分頁依目前推薦推不出注項' }
      // 組合型玩法的推薦是「一注」，其餘玩法每個推薦注項各自一注
      const items: SelectItem[] = recommend?.codes.length
        ? [{ playId: `${state.selectTabId}-${wanted.join('-')}`, name: wanted.join('、'), codes: [...wanted], coin: amount }]
        : wanted.map((name) => {
          const found = select.pool.find((item) => _normalizeBetName(item.name) === _normalizeBetName(name))
          return { playId: found?.playId ?? `${state.selectTabId}-${name}`, name: found?.name ?? name, coin: amount }
        })
      return fetch.submitBetItems(items, { clearSelection: false })
    }
    const items = _autoBetItems(Number(input?.count) || 1, amount)
    if (items.length === 0) return { ok: false, message: '目前分頁組不出可自動投注的注項' }
    return fetch.submitBetItems(items, { clearSelection: false })
  },
  // 共用送單流程（三段狀態 + 本地當期注單 + 餘額／當期資訊刷新）
  submitBetItems: async (items: SelectItem[], options?: { clearSelection?: boolean }) => {
    if (state.submitStatus === 'loading') return { ok: false, message: '投注處理中' }
    const activePlay = state.activePlay
    const betItems = (Array.isArray(items) ? items : []).filter((item) => Number(item?.coin) > 0)
    if (!activePlay || betItems.length === 0) {
      state.message = '請先選擇注項並填入金額'
      return { ok: false, message: state.message }
    }
    const totalAmount = betItems.reduce((acc, item) => acc + Number(item.coin || 0), 0)
    if (!(totalAmount > 0)) {
      state.message = '下注金額需大於 0'
      return { ok: false, message: state.message }
    }
    state.submitStatus = 'loading'
    state.errorMessage = ''
    state.message = ''
    try {
      const groups = [
        {
          playKey: activePlay.key,
          playTypeName: state.selectedTypeName,
          playList: betItems.map((item) => {
            const num = Number(item.name)
            return {
              playId: item.playId,
              selectTabId: state.selectTabId,
              label: String(item.name),
              num: Number.isFinite(num) && num > 0 ? num : undefined,
              amount: Number(item.coin), // 每注各自金額
              // 連碼：一注帶多個號碼，伺端逐注驗證號碼組是否合法
              ...(Array.isArray(item.codes) && item.codes.length > 0 ? { codes: item.codes } : {}),
            }
          }),
        },
      ]
      const result = await creditService.submitBet({
        lottery: { id: LOTTERY['LHC-CD'].id, key: LOTTERY['LHC-CD'].key },
        amount: totalAmount, // 總額 = 各注加總
        groups,
      })
      state.lastOrderId = String(result?.orderId || '')
      state.lastOrders = Array.isArray(result?.orders) ? result.orders : []
      state.submitStatus = 'success'
      state.message = '下注成功'

      // 存入本地當期注單（供「當期注單」liveQuery 監看即時顯示）
      await _saveOrders(result?.orders, orderQuery.userId, String(current.runtime?.issueCurrent ?? orderQuery.issue))

      //--- HANDLE 清空選取（自動投注不清，避免蓋掉使用者正在編輯的注項） --
      if (options?.clearSelection !== false) {
        state.selectedCodes = []
        select.items = []
        select.resetToken++ // 觸發玩法頁 layout 重新 init（號碼球 select=false / 金額 coin=0）
      }

      // 更新餘額 / 注項統計 / 當期資訊
      await fetch.userInfo()
      await fetch.refreshCurrentInfo()
      return { ok: true, message: state.message, count: betItems.length, amount: totalAmount }
    } catch (error) {
      state.submitStatus = 'error'
      state.errorMessage = _getBetErrorMessage(error)
      return { ok: false, message: state.errorMessage }
    }
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
    _stopOrderDetailSync()
  },
  run: () => { }
}
init.run()

// HMR cleanup: stop module-scoped watcher / RAF / timers before this module
// is hot-replaced, so old singleton effects don't pile up across dev reloads.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopOpeningWatch()
    _stopOpeningTick()
    init.stopServerTimeSync()
  })
}

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
      state.amount = _handlers.clampCoin(normalized)
    },
    // 依當前分頁限額夾值（下注金額欄 / 快捷加值 / 自動投注共用）
    clampAmountToQuota: () => {
      state.amount = _handlers.clampCoin(state.amount)
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
    // ── Select pool（玩法頁注項池 / 隨機選號） ─────────────────────
    // 玩法頁 layout 初始化時登記當前分頁所有注項（同一批 reactive 物件，直接改 select / coin 會反映到畫面）
    registerSelectPool: (items: SelectItem[]) => {
      select.pool = Array.isArray(items) ? items : []
    },
    // 依 pool 的 select 狀態同步「當前注項」清單（連碼會展開成組合，見 _syncSelectItems）
    syncSelectItems: () => {
      _syncSelectItems()
    },
    // 隨機選號：從當前分頁的號碼球（純數字注項）隨機取 count 注，套用當前金額
    // 兩面 / 色波等文字注項（特大特小、紅波…）互斥語意不適合亂數帶入，僅在無號碼球時才退回全部注項
    // 連碼：count 的單位是「號碼數」而非注數，且需夾在 minPick ~ maxPick 之間
    randomSelect: (count: number) => {
      if (state.submitStatus === 'loading') return 0
      const pool = _handlers.randomPool()
      if (pool.length === 0) return 0
      const combo = currentCombo.value
      const size = combo
        ? Math.min(combo.maxPick, Math.max(combo.minPick, Math.trunc(Number(count) || 0) || combo.minPick))
        : Math.max(1, Math.min(Math.trunc(Number(count) || 0) || 1, pool.length))
      const picked = _handlers.shuffle(pool).slice(0, size)
      const pickedIds = new Set(picked.map((item) => String(item.playId)))
      // 先清掉當前分頁既有選取，再套用隨機結果（避免同分頁重複累加）
      select.pool.forEach((item) => {
        item.select = pickedIds.has(String(item.playId))
        item.coin = item.select ? state.amount : 0
      })
      state.selectedCodes = Array.from(pickedIds)
      _actions.syncSelectItems()
      return picked.length
    },
    // 清空當前分頁選取（號碼球取消選取、金額歸零）
    clearSelect: () => {
      if (state.submitStatus === 'loading') return
      select.pool.forEach((item) => {
        item.select = false
        item.coin = 0
      })
      state.selectedCodes = []
      _actions.syncSelectItems()
    },
    /**
     * 套用號碼推薦（「加入注項」用）
     *
     * 舊版只拿推薦號碼比對數字注項名稱，所以只有特碼／正碼／正碼特／連碼有用 ——
     * 五行、半波、一肖、尾數、七碼、一肖量… 注項名稱不是數字的玩法一律推不出來。
     * 改由 creditRecommendOf 把「對沖排序」換算成當前分頁該選哪些注項，全玩法通用。
     *
     * 與 randomSelect 相同語意 —— 取代當前分頁既有選取、套用當前金額。
     * @param ranked 對沖值由高到低排序的號碼（全部 49 個）
     * @returns null 表示此分頁推不出注項；否則回推薦內容與實際加入的注數
     */
    selectByRecommend: (ranked: Array<string | number>) => {
      if (state.submitStatus === 'loading') return null
      const recommend = _recommendOf(ranked)
      if (!recommend) return null
      // 組合型玩法回 codes（一注的號碼／生肖／尾數），其餘回 names（各自獨立一注）
      const wanted = recommend.codes.length > 0 ? recommend.codes : recommend.names
      if (wanted.length === 0) return null
      const wantedNames = new Set(wanted.map(_normalizeBetName))
      const matched = select.pool.filter((item) => wantedNames.has(_normalizeBetName(item.name)))
      if (matched.length === 0) return null
      const matchedIds = new Set(matched.map((item) => String(item.playId)))
      select.pool.forEach((item) => {
        item.select = matchedIds.has(String(item.playId))
        item.coin = item.select ? state.amount : 0
      })
      state.selectedCodes = Array.from(matchedIds)
      _actions.syncSelectItems()
      // 組合型玩法選 pick 個號碼只成一注，注數要看展開後的 select.items
      return { ...recommend, applied: select.items.length }
    },
    // ── Play ────────────────────────────────────────────────────
    // 切換玩法時把分頁（BarTabs）指回該玩法第一個分頁，並清掉上一個玩法殘留的選取
    // 沒有這步的話 selectTabId 會停在舊玩法的 tabId（如 2000），
    // 新玩法的 layout 找不到對應分頁 → 注項面板整片空白
    syncPlayTabs: (playKey: string) => {
      const play = C_PLAYS.find((item) => item.key === playKey)
      const firstTab = play?.list?.[0]
      if (firstTab) {
        state.selectTabId = Number(firstTab.tabId)
        state.selectTabName = String(firstTab.tabName)
      }
      state.selectedCodes = []
      select.items = []
      select.pool = []
      // ⚠️ 這裡清掉 pool 後一定要 bump resetToken 通知玩法頁重新登記。
      // 玩法頁的 layout 是 computed、pool 在其中以副作用登記；
      // 若切進來的玩法第一個分頁剛好等於 selectTabId 現值（首次載入預設玩法「特碼」就是這樣），
      // layout 的相依沒變 → 不會重算 → pool 永遠是空的，
      // 隨機選號 / 清空 / 號碼推薦全都會失效，直到使用者手動點過分頁。
      select.resetToken += 1
    },
    fetchTypeByName: async (typeName: string) => {
      if (state.fetchStatus === 'loading' || !state.activePlay) return
      if (!state.activePlay.playTypeNames?.includes(typeName) || state.selectedTypeName === typeName) return
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
      // 同玩法且已初始化才略過；首次載入（activePlay 尚未設定）仍需設定 activePlay
      if (state.fetchStatus === 'loading' || (state.select === playKey && state.activePlay)) return
      state.fetchStatus = 'loading'
      state.errorMessage = ''
      try {
        const nextPlay = _handlers.resolvePlayDefinition(playKey)
        if (!nextPlay) throw new Error('找不到指定玩法')
        state.select = playKey
        state.activePlay = nextPlay
        _actions.syncPlayTabs(playKey)
        // CREDIT_PLAY_DEFINITIONS 的項目僅有 key / name，playTypeNames 可能不存在
        state.selectedTypeName = nextPlay.playTypeNames?.[0] || ''
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
        const initialPlay = _handlers.resolvePlayDefinition(state.select)
        if (!initialPlay) throw new Error('初始化玩法失敗')
        state.activePlay = initialPlay
        _actions.syncPlayTabs(state.select)
        state.selectedTypeName = initialPlay.playTypeNames?.[0] || ''
        state.fetchStatus = 'success'
      } catch (error) {
        state.fetchStatus = 'error'
        state.errorMessage = error instanceof Error ? error.message : '初始化失敗'
      }
    },
  }

  const _handlers = {
    // 依當前分頁的單注限額夾值（min ≤ coin ≤ max）
    clampCoin: (coin: number | string) => {
      const quota = currentQuota.value
      const num = Math.trunc(Number(coin) || 0)
      return Math.min(quota.item.max, Math.max(quota.item.min, num))
    },
    // 隨機選號 / 自動投注共用同一組 pool 與洗牌邏輯（module-level）
    randomPool: (): SelectItem[] => _randomBetPool(),
    shuffle: (list: SelectItem[]): SelectItem[] => _shuffleBetItems(list),
    resolvePlayDefinition: (playKey: string): CreditPlayDefinition | null => {
      return (CREDIT_PLAY_DEFINITIONS as CreditPlayDefinition[]).find((item) => item.key === playKey) || null
    },
    getTypeOptions: (play: CreditPlayDefinition | null, typeName: string): PlayOption[] => {
      if (!play || !typeName) return []
      const options = (play.playTypeOptions || {})[typeName]
      return Array.isArray(options) ? options : []
    },
  }

  return {
    state,
    current,
    road,
    analyze,
    userRecord,
    openCodeHistory,
    wallet,
    select,

    playList,
    availableCodes,
    canSubmit,
    click,
    actions: _actions,
    init,
    fetch,

    groupList,
    // 依對沖排序算出當前分頁的推薦注項（純查詢，供號碼推薦面板顯示）
    recommendOf: _recommendOf,
    // 自動投注一次最多能送幾注（組合型玩法為 C(maxPick, pick)，與伺端上限同一條）
    autoBetMaxCount: _autoBetMaxCount,
    currentQuota,
    currentCombo,
    currentTiers,
    comboMaxBets,

    //
    time,
    livePool,
    jackpot,
    isOpening,
    openingRevealedIndices,
    openingRevealedNumbers,
  }
}
