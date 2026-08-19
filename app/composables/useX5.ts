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

/**
 * 11選5 前端狀態（X5-CD 信用盤／X5-OF 官方盤共用一支）
 *
 * ── 為什麼兩個盤口共用一支 composable ────────────────────
 *   兩邊的期別、倒數、開獎號、彩池都來自伺端的同一份共用狀態
 *   （server/services/game/lottery/bg/x5Shared.ts），前端沒有理由拆成兩份互相打架。
 *   差異只有「注項怎麼選」。
 *
 * ── 階段 1 的範圍 ───────────────────────────────────────
 *   ⚠️ 目前**只有信用盤**（讀 shared/config/x5cd 的 4 分頁 112 注項）。
 *      `state.mode` / `isCd` / `lotteryMeta` 已經按盤口分流，共用元件靠它切文案；
 *      階段 2 要補的是三處，比照 useSsc.ts 的對應段落：
 *        1. `og` 選號狀態 + ogXxx computed（讀 shared/config/x5of）
 *        2. `_actions.setMode()`（切盤口要清掉選取與上一盤的紀錄）
 *        3. fetch 層的 of 分支（currentX5Of / userRecordX5Of / claimOneIssueX5Of / betsOf）
 *      在官方盤設定還不存在時先寫這些等於憑空假設注項形狀，故不預埋。
 *
 * ⚠️ state 是 module 級單例（與 useSsc / useK3 相同做法）。
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

// 切換分頁／玩法時把金額夾回新分頁限額（超限會被伺端整筆拒單）
watch(() => [state.select, state.selectTabId], () => {
  const quota = currentQuota.value
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
      const result = await api.lottery.currentX5Cd()
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
  /** 爆池狀態（兩個盤口共吃一池，階段 2 的 of 路由會回同一份） */
  creditJackpot: async () => {
    try {
      Object.assign(creditJackpot, await api.lottery.jackpotX5Cd())
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
      const res = await api.lottery.userRecordX5Cd()
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
      const res = await api.lottery.openCodeHistoryX5Cd()
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
      const res = await api.lottery.claimOneIssueX5Cd()
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
      _actions.clearSelect()
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

    actions: _actions,
    fetch,
    /** 玩法定義（供玩法列表對帳） */
    playDefinitions: X5_PLAY_DEFINITIONS,
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
