import { computed, reactive, ref, watch } from 'vue'
import { LOTTERY, STATUS_TIME } from '~/config/constants'
import {
  api,
  type K3Current,
  type K3Pool,
  type K3UserBetHistory,
  type LotteryUserBalanceChange,
  type LotteryClaimableIssue,
  type LotteryOpenCodeHistoryItem
} from '~/services/api'
import { judgeK3Bet, K3_PLAY_DEFINITIONS } from '#shared/config/k3-cd'
import { k3OfPicksOf, K3_OF_PICK_COUNT, K3_OF_PRIZE_TIERS } from '#shared/config/k3-of'
import { K3_DICE_MAX, k3SumOf } from '#shared/config/k3'
import C_PLAYS from '#shared/config/k3cd/plays'
import { findK3Tab, k3QuotaOf, k3TabOddsOf } from '#shared/config/k3cd/helpers'

/**
 * 快3 前端狀態（K3-CD 信用盤 / K3-OF 官方盤共用一支）
 *
 * ── 為什麼兩個盤口共用一支 composable ────────────────────
 *   兩邊的期別、倒數、開獎骰子、彩池都來自伺端的同一份共用狀態
 *   （server/services/k3Shared.ts），前端沒有理由拆成兩份互相打架。
 *   差異只有「注項怎麼選」與「怎麼派彩」：
 *     mode = 'cd' → 讀 shared/config/k3cd 的注項，按賠率派彩
 *     mode = 'of' → 選 3 個點數，依命中顆數分層從獎池分配
 *
 * ⚠️ state 是 module 級單例（與 use6hcCredit 相同做法），
 *    切換盤口時務必呼叫 actions.setMode() 重置選取，否則會把 CD 的注項帶進 OF。
 */

export type K3Mode = 'cd' | 'of'

/** 看板注項（由 config tabGroup.groupList 複製而來，select / coin 為前端選取狀態） */
export type K3SelectItem = {
  playId: string | number
  name: string | number
  odds?: number
  coin?: string | number
  select?: boolean
  /** 官方盤：該注的 3 個點數 */
  codes?: string[]
}

// ── Module-level singletons ────────────────────────────────────────────────
const state = reactive({
  mode: 'cd' as K3Mode,
  /** 信用盤：當前玩法（hezhi / daxiao…） */
  select: String(C_PLAYS[0]?.key ?? ''),
  selectTabId: Number(C_PLAYS[0]?.list?.[0]?.tabId ?? 0),
  selectTabName: String(C_PLAYS[0]?.list?.[0]?.tabName ?? ''),
  amount: 10 as number,
  fetchStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',
  submitStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',
  message: '' as string,
  errorMessage: '' as string,
  lastOrderId: '' as string
})

const current = reactive({
  runtime: null as K3Current | null,
  /** 當期自己的注單（下注成功後本地追加，開獎後由 user-record 覆蓋） */
  detail: [] as Array<{ orderId: string; betCode: string[]; coin: number; odds?: number; time: string }>
})

const pool = reactive<K3Pool>({ issue: '', base: 0, carry: 0, issuePool: 0, distributable: 0 })

const select = reactive({
  items: [] as K3SelectItem[],
  pool: [] as K3SelectItem[],
  show: true,
  resetToken: 0
})

/** 官方盤：3 欄點數選單的當前選擇（0 = 未選） */
const ofPicks = reactive({ list: [0, 0, 0] as number[] })

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
  betHistory: [] as K3UserBetHistory[],
  claimableIssues: [] as LotteryClaimableIssue[]
})

const openCodeHistory = reactive({
  isLoading: false,
  errorMessage: '',
  list: [] as LotteryOpenCodeHistoryItem[]
})

// ── Computed ───────────────────────────────────────────────────────────────
const isCd = computed(() => state.mode === 'cd')
const lotteryMeta = computed(() => (isCd.value ? LOTTERY['K3-CD'] : LOTTERY['K3-OF']))
/** 信用盤的玩法清單（官方盤只有一種選號方式，不走這個） */
const playList = computed(() => C_PLAYS as Array<{ key?: string; name?: string; list?: any[] }>)
/** 當前玩法的分頁清單 */
const groupList = computed(() => playList.value.find((play) => play.key === state.select)?.list ?? [])
/** 當前分頁限額 */
const currentQuota = computed(() => k3QuotaOf(state.select, state.selectTabId))
/** 已選注項數 */
const selectedCount = computed(() => select.items.filter((item) => Number(item.coin) > 0).length)
/** 本次投注總額 */
const totalAmount = computed(() =>
  Number(select.items.reduce((sum, item) => sum + Number(item.coin ?? 0), 0).toFixed(2))
)
const isOpen = computed(() => String(current.runtime?.currentStatus ?? '') === STATUS_TIME.OPEN)
const canSubmit = computed(() =>
  isOpen.value && state.submitStatus !== 'loading' && totalAmount.value > 0
)
/** 官方盤：3 欄都選了才成一注 */
const ofPicked = computed(() => ofPicks.list.every((num) => num >= 1 && num <= K3_DICE_MAX))
/** 官方盤預估：命中顆數要開獎後才知道，這裡只顯示分層規則 */
const ofPrizeTiers = computed(() => K3_OF_PRIZE_TIERS)

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

/** 依 pool 的 select 狀態重算「當前注項」 */
function _syncSelectItems() {
  select.items = select.pool.filter((item) => Boolean(item.select))
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
  /** 切換盤口：注項語意不同，必須清掉選取 */
  setMode: (mode: K3Mode) => {
    if (state.mode === mode) return
    state.mode = mode
    _actions.clearSelect()
    ofPicks.list = [0, 0, 0]
  },
  /** 切換玩法（信用盤）：分頁指回該玩法第一個 */
  setPlay: (playKey: string) => {
    const play = C_PLAYS.find((item: any) => item.key === playKey)
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
    const tab = findK3Tab(state.select, tabId)
    if (!tab) return
    state.selectTabId = Number(tab.tabId)
    state.selectTabName = String(tab.tabName)
    select.items = []
    select.pool = []
    select.resetToken += 1
  },
  /** 看板初始化時登記當前分頁所有注項（同一批 reactive 物件，改 select / coin 會反映到畫面） */
  registerSelectPool: (items: K3SelectItem[]) => {
    select.pool = Array.isArray(items) ? items : []
  },
  syncSelectItems: () => { _syncSelectItems() },
  /** 點注項：切換選取並套用當前金額 */
  toggleItem: (playId: string | number) => {
    const item = select.pool.find((option) => String(option.playId) === String(playId))
    if (!item) return
    item.select = !item.select
    item.coin = item.select ? state.amount : 0
    _syncSelectItems()
  },
  /** 隨機選 count 個注項 */
  randomSelect: (count: number) => {
    if (select.pool.length === 0) return 0
    const size = Math.max(1, Math.min(Math.trunc(Number(count) || 1), select.pool.length))
    const shuffled = [...select.pool]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = shuffled[i] as K3SelectItem
      shuffled[i] = shuffled[j] as K3SelectItem
      shuffled[j] = tmp
    }
    const pickedIds = new Set(shuffled.slice(0, size).map((item) => String(item.playId)))
    select.pool.forEach((item) => {
      item.select = pickedIds.has(String(item.playId))
      item.coin = item.select ? state.amount : 0
    })
    _syncSelectItems()
    return pickedIds.size
  },
  clearSelect: () => {
    select.pool.forEach((item) => { item.select = false; item.coin = 0 })
    select.items = []
  },
  /** 官方盤：設定第 idx 欄的點數 */
  setOfPick: (idx: number, num: number) => {
    if (idx < 0 || idx >= K3_OF_PICK_COUNT) return
    ofPicks.list[idx] = Number(num)
  },
  clearOfPicks: () => { ofPicks.list = [0, 0, 0] },
  /** 官方盤：隨機選 3 個點數 */
  randomOfPicks: () => {
    ofPicks.list = Array.from({ length: K3_OF_PICK_COUNT }, () => Math.floor(Math.random() * K3_DICE_MAX) + 1)
  },
  /** 該注項照某組開獎會不會中（畫面標示用，與結算共用同一支判定） */
  judgeItem: (betCode: string, openCode: string[], odds = 0) =>
    judgeK3Bet(betCode, openCode, 1, odds),
  sumOf: (openCode: string[]) => {
    const dice = (Array.isArray(openCode) ? openCode : []).map(Number)
    return dice.length >= 3 && dice.every((n) => n >= 1 && n <= K3_DICE_MAX) ? k3SumOf(dice.slice(0, 3)) : 0
  }
}

// ── Fetch ──────────────────────────────────────────────────────────────────
const fetch = {
  refreshCurrentInfo: async () => {
    try {
      const result = isCd.value ? await api.lottery.currentK3Cd() : await api.lottery.currentK3Of()
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
      const res = isCd.value ? await api.lottery.userRecordK3Cd() : await api.lottery.userRecordK3Of()
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
        ? await api.lottery.openCodeHistoryK3Cd()
        : await api.lottery.openCodeHistoryK3Of()
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
      const res = isCd.value ? await api.lottery.claimOneIssueK3Cd() : await api.lottery.claimOneIssueK3Of()
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
  /** 官方盤投注：一注 = 3 個點數 */
  betsOf: async () => {
    const picks = k3OfPicksOf(ofPicks.list)
    if (!picks) {
      state.message = `請選滿 ${K3_OF_PICK_COUNT} 個點數`
      return { ok: false, message: state.message }
    }
    const coin = Math.trunc(Number(state.amount) || 0)
    if (!(coin > 0)) {
      state.message = '請填入投注金額'
      return { ok: false, message: state.message }
    }
    return fetch.submit(
      [{
        playKey: 'xuanhao',
        playTypeName: '選號',
        playList: [{ codes: picks.map(String), amount: coin, label: picks.join(',') }]
      }],
      coin
    )
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
      else _actions.clearOfPicks()
      select.resetToken += 1
      await fetch.userInfo()
      return { ok: true, message: state.message, count: ((result as any)?.orders ?? []).length, amount }
    } catch (error) {
      state.submitStatus = 'error'
      const err = error as any
      state.errorMessage = String(
        err?.data?.statusMessage ?? err?.data?.message ?? (error instanceof Error ? error.message : '下注失敗')
      )
      return { ok: false, message: state.errorMessage }
    }
  },
  initPageData: async () => {
    state.fetchStatus = 'loading'
    await Promise.all([fetch.refreshCurrentInfo(), fetch.userInfo(), fetch.openCodeHistoryAll()])
    state.fetchStatus = 'success'
  },
  startPolling: () => {
    if (!clockTimer) clockTimer = setInterval(_tickServerNow, 250)
    if (!pollTimer) {
      pollTimer = setInterval(() => {
        const before = String(current.runtime?.issueLatest ?? '')
        fetch.refreshCurrentInfo().then(() => {
          // 期別換了代表上一期已開獎，把注單結果與可領獎金一起刷新
          if (String(current.runtime?.issueLatest ?? '') !== before) {
            current.detail = []
            fetch.userRecordAll()
          }
        })
      }, 3000)
    }
  },
  stopPolling: () => {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }
}

export function useK3() {
  return {
    state,
    current,
    pool,
    select,
    ofPicks,
    wallet,
    time,
    userRecord,
    openCodeHistory,

    isCd,
    lotteryMeta,
    playList,
    groupList,
    currentQuota,
    selectedCount,
    totalAmount,
    isOpen,
    canSubmit,
    ofPicked,
    ofPrizeTiers,

    actions: _actions,
    fetch,
    /** 玩法定義（供玩法列表對帳） */
    playDefinitions: K3_PLAY_DEFINITIONS,
    /** 注項賠率查詢（依分頁 rtp 即時推算） */
    oddsOf: k3TabOddsOf
  }
}
