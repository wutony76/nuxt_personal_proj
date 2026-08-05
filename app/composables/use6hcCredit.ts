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

import C_TEMA from '#shared/config/cd/c_tema'


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
  select: C_TEMA[0].key as string,
  selectTabId: C_TEMA[0].list[0].tabId as number,
  selectTabName: C_TEMA[0].list[0].tabName as string,
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
// 注號分析排序模式（預設 / 下注次數(自) / 攪出次數(系) / 相隔期數(系)）
const analyze = reactive({
  status: SORT.DEFAULT as string,
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
// 依目前 select(玩法) + selectTabId(分頁) 取出對應 config 的 tabGroup 群組
const groupList = computed(() => {
  const play = C_TEMA.find((item) => item.key === state.select)
  return play?.list ?? []
  // const tab = play?.list.find((item) => item.tabId === state.selectTabId)
  // return tab?.tabGroup ?? []
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

// 依 select_tab_id 從 config 取分頁名（如 2000 → 特碼A），取不到則回空字串
function _resolveTabName(tabId?: number): string {
  const id = Number(tabId)
  if (!Number.isFinite(id) || id <= 0) return ''
  for (const play of C_TEMA) {
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
  // 自動投注：從當前分頁隨機取 count 注（每注 amount），不動使用者手動選取的注項
  autoBets: async (input: { count: number; amount: number }) => {
    const amount = Math.trunc(Number(input?.amount) || 0)
    if (amount <= 0) return { ok: false, message: '自動投注金額需大於 0' }
    const pool = _randomBetPool()
    if (pool.length === 0) return { ok: false, message: '目前分頁沒有可自動投注的號碼' }
    const size = Math.max(1, Math.min(Math.trunc(Number(input?.count) || 1), pool.length))
    const items = _shuffleBetItems(pool)
      .slice(0, size)
      .map((item) => ({ playId: item.playId, name: item.name, coin: amount }))
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
    // ── Select pool（玩法頁注項池 / 隨機選號） ─────────────────────
    // 玩法頁 layout 初始化時登記當前分頁所有注項（同一批 reactive 物件，直接改 select / coin 會反映到畫面）
    registerSelectPool: (items: SelectItem[]) => {
      select.pool = Array.isArray(items) ? items : []
    },
    // 依 pool 的 select 狀態同步「當前注項」清單
    syncSelectItems: () => {
      select.items = select.pool.filter((item) => Boolean(item.select))
    },
    // 隨機選號：從當前分頁的號碼球（純數字注項）隨機取 count 注，套用當前金額
    // 兩面 / 色波等文字注項（特大特小、紅波…）互斥語意不適合亂數帶入，僅在無號碼球時才退回全部注項
    randomSelect: (count: number) => {
      if (state.submitStatus === 'loading') return 0
      const pool = _handlers.randomPool()
      if (pool.length === 0) return 0
      const size = Math.max(1, Math.min(Math.trunc(Number(count) || 0) || 1, pool.length))
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
    // 依號碼套用選取（號碼推薦「加入注項」用）：以注項名稱比對號碼球，套用當前金額
    // 與 randomSelect 相同語意 — 取代當前分頁既有選取；回傳實際套用注數（0 表示此分頁無對應號碼）
    selectByNumbers: (numbers: Array<string | number>) => {
      if (state.submitStatus === 'loading') return 0
      const wanted = new Set(
        (Array.isArray(numbers) ? numbers : [])
          .map((num) => Number(num))
          .filter((num) => Number.isFinite(num) && num > 0)
      )
      if (wanted.size === 0) return 0
      const matched = select.pool.filter((item) => wanted.has(Number(item.name)))
      if (matched.length === 0) return 0
      const matchedIds = new Set(matched.map((item) => String(item.playId)))
      select.pool.forEach((item) => {
        item.select = matchedIds.has(String(item.playId))
        item.coin = item.select ? state.amount : 0
      })
      state.selectedCodes = Array.from(matchedIds)
      _actions.syncSelectItems()
      return matched.length
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
      // 同玩法且已初始化才略過；首次載入（activePlay 尚未設定）仍需設定 activePlay
      if (state.fetchStatus === 'loading' || (state.select === playKey && state.activePlay)) return
      state.fetchStatus = 'loading'
      state.errorMessage = ''
      try {
        const nextPlay = _handlers.resolvePlayDefinition(playKey)
        if (!nextPlay) throw new Error('找不到指定玩法')
        state.select = playKey
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
        const initialPlay = _handlers.resolvePlayDefinition(state.select)
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
  }

  const _handlers = {
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

    //
    time,
    livePool,
    jackpot,
    isOpening,
    openingRevealedIndices,
    openingRevealedNumbers,
  }
}
