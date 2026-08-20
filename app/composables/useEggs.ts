import { computed, reactive, watch } from 'vue'
import { LOTTERY, STATUS_TIME, STATUS_ERR_CODE } from '~/config/constants'
import {
  api,
  type EggsCurrent,
  type EggsUserBetHistory,
  type CreditJackpotState,
  type PoolPlayState,
  type LotteryUserBalanceChange,
  type LotteryClaimableIssue,
  type LotteryOpenCodeHistoryItem
} from '~/services/api'
import {
  judgeEggsBet,
  EGGS_PLAY_DEFINITIONS,
  EGGS_POOL_PLAY_KEY,
  EGGS_POOL_PICK_COUNT,
  EGGS_POOL_QUOTA
} from '#shared/config/eggs-cd'
import { eggsSumOf, eggsDigitsOf } from '#shared/config/eggs'
import C_PLAYS from '#shared/config/eggscd/plays'
import { findEggsTab, eggsQuotaOf, eggsTabOddsOf } from '#shared/config/eggscd/helpers'

/**
 * PC蛋蛋（EGGS）前端狀態
 *
 * ── 與 useK3 / useSsc 的差異 ────────────────────────────
 *   來源（bglottery pceggs）只有信用模式、沒有官方盤，
 *   所以沒有 mode / setMode、沒有官方盤選號、也沒有共用彩池。
 *   架構單純比照 K3-CD 那一半（select.pool → toggleItem → submit）。
 *
 * ⚠️ state 是 module 級單例（與 useK3 相同做法）。
 */

/** 看板注項（由 config tabGroup.groupList 複製而來，select / coin 為前端選取狀態） */
export type EggsSelectItem = {
  playId: string | number
  name: string | number
  odds?: number
  coin?: string | number
  select?: boolean
}

// ── Module-level singletons ────────────────────────────────────────────────
const state = reactive({
  /** 當前玩法（daxiao / danshuang / tese / sebo / tema） */
  select: String(C_PLAYS[0]?.key ?? ''),
  selectTabId: Number(C_PLAYS[0]?.list?.[0]?.tabId ?? 0),
  selectTabName: String(C_PLAYS[0]?.list?.[0]?.tabName ?? ''),
  /** 投注金額：點注項時套用這個值，也可在看板逐項改 */
  amount: 10 as number,
  fetchStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',
  submitStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',
  message: '' as string,
  errorMessage: '' as string,
  lastOrderId: '' as string
})

const current = reactive({
  runtime: null as EggsCurrent | null,
  /** 當期自己的注單（下注成功後本地追加，開獎後由 user-record 覆蓋） */
  detail: [] as Array<{ orderId: string; betCode: string[]; coin: number; odds?: number; time: string }>
})

const select = reactive({
  items: [] as EggsSelectItem[],
  pool: [] as EggsSelectItem[],
  show: true,
  resetToken: 0
})

/**
 * 爆池狀態
 * ⚠️ PC蛋蛋沒有官方盤、也沒有共用彩池 —— 這是它唯一的池，
 *    不像 k3 / pk10 / ssc 的看板要同時顯示「總獎金」與「爆池」兩個數字。
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

/**
 * 彩池玩法（選號）狀態 —— 與上面的爆池是兩個獨立的池，互不影響
 * ⚠️ 這個玩法刻意不進 eggscd/plays.js（比照 k3-of 的 xuanhao），playList 由 `playList` 計算屬性
 *    合成注入。跟 KL10 的號碼池不同：PC蛋蛋開獎可重複（0~9），改用「N 個獨立槽位」介面
 *    （比照 k3-of 的 Picker.vue：第一碼/第二碼/第三碼各自選一個 0~9），不是 toggle 式號碼池。
 */
const poolPlay = reactive({
  /** EGGS_POOL_PICK_COUNT 個槽位，各自選一個 0~9；未選為 null */
  picks: Array.from({ length: EGGS_POOL_PICK_COUNT }, () => null as number | null),
  /** 單注金額（固定一注，不像任何複式展開） */
  amount: 10 as number
})

/** 彩池玩法的池底／抽水／滾存／分層獎金表（取不到就維持舊值，不蓋掉主要流程的錯誤訊息） */
const poolPlayState = reactive<PoolPlayState>({
  issue: '',
  base: 0,
  carry: 0,
  issuePool: 0,
  distributable: 0,
  prizeTiers: []
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
  betHistory: [] as EggsUserBetHistory[],
  claimableIssues: [] as LotteryClaimableIssue[]
})

const openCodeHistory = reactive({
  isLoading: false,
  errorMessage: '',
  list: [] as LotteryOpenCodeHistoryItem[]
})

// ── Computed ───────────────────────────────────────────────────────────────
const lotteryMeta = computed(() => LOTTERY.EGGS)
/**
 * 玩法清單：附加彩池玩法（選號）的合成分頁項目
 * ⚠️ 這個玩法刻意不進 C_PLAYS（eggscd/plays.js），比照 k3-of 的 xuanhao —— 沒有對應的看板分頁，
 *    `list` 留空即可，頁面的子分頁列本來就 `v-if="groupList.length > 1"`，會自動不顯示。
 */
const playList = computed(() => [
  ...(C_PLAYS as Array<{ key?: string; name?: string; list?: any[] }>),
  { key: EGGS_POOL_PLAY_KEY, name: '選號（彩池）', list: [] }
])
/** 當前玩法的分頁清單 */
const groupList = computed(() => playList.value.find((play) => play.key === state.select)?.list ?? [])
/** 是否為彩池玩法（選號）分頁 */
const isPoolPlay = computed(() => state.select === EGGS_POOL_PLAY_KEY)
/** 當前分頁限額（彩池玩法用自己的硬編碼額度，不查 eggscd 的看板設定） */
const currentQuota = computed(() => isPoolPlay.value ? EGGS_POOL_QUOTA : eggsQuotaOf(state.select, state.selectTabId))
/** 已選注項數 */
const selectedCount = computed(() => select.items.filter((item) => Number(item.coin) > 0).length)
/** 彩池玩法：已選滿全部槽位（0~9，可重複，跟 KL10 的「不重複」不同） */
const poolPlayReady = computed(() => poolPlay.picks.every((digit) => digit !== null))
/** 本次投注總額（依當前看板模式取其一） */
const totalAmount = computed(() => {
  if (isPoolPlay.value) return Math.max(0, Math.trunc(Number(poolPlay.amount) || 0))
  return Number(select.items.reduce((sum, item) => sum + Number(item.coin ?? 0), 0).toFixed(2))
})
const isOpen = computed(() => String(current.runtime?.currentStatus ?? '') === STATUS_TIME.OPEN)
const canSubmit = computed(() =>
  isOpen.value && state.submitStatus !== 'loading' && totalAmount.value > 0
  && (!isPoolPlay.value || poolPlayReady.value)
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

/** 重算「當前注項」：isactive || money > 0（與 useK3 同一套） */
function _syncSelectItems() {
  select.items = select.pool.filter((item) => Boolean(item.select) || Number(item.coin) > 0)
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
    const play = C_PLAYS.find((item: any) => item.key === playKey)
    const firstTab = play?.list?.[0]
    state.select = playKey
    if (firstTab) {
      state.selectTabId = Number(firstTab.tabId)
      state.selectTabName = String(firstTab.tabName)
    }
    select.items = []
    select.pool = []
    _actions.clearPool()
    // 看板的 layout 是 computed，清掉 pool 後要 bump 讓它重新登記
    select.resetToken += 1
  },
  setTab: (tabId: number | string) => {
    const tab = findEggsTab(state.select, tabId)
    if (!tab) return
    state.selectTabId = Number(tab.tabId)
    state.selectTabName = String(tab.tabName)
    select.items = []
    select.pool = []
    select.resetToken += 1
  },
  /** 看板初始化時登記當前分頁所有注項（同一批 reactive 物件，改 select / coin 會反映到畫面） */
  registerSelectPool: (items: EggsSelectItem[]) => {
    select.pool = Array.isArray(items) ? items : []
  },
  syncSelectItems: () => { _syncSelectItems() },
  /** 點注項：切換選取，選取時套用投注金額（同 useK3 的 toggleItem） */
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
    const shuffled = [...select.pool]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = shuffled[i] as EggsSelectItem
      shuffled[i] = shuffled[j] as EggsSelectItem
      shuffled[j] = tmp
    }
    const pickedIds = new Set(shuffled.slice(0, size).map((item) => String(item.playId)))
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
  /** 該注項照某組開獎會不會中（畫面標示用，與結算共用同一支判定） */
  judgeItem: (betCode: string, openCode: string[], odds = 0) =>
    judgeEggsBet(betCode, openCode, 1, odds),
  sumOf: (openCode: string[]) => {
    const digits = eggsDigitsOf((Array.isArray(openCode) ? openCode : []).map(Number))
    return digits ? eggsSumOf(digits) : 0
  },
  /** 彩池玩法：設定第 index 槽位的數字（0~9），比照 k3-of Picker 的「第X顆」介面 */
  setPoolPick: (index: number, digit: number) => {
    if (index < 0 || index >= EGGS_POOL_PICK_COUNT) return
    const safeDigit = Math.trunc(Number(digit))
    if (!(safeDigit >= 0 && safeDigit <= 9)) return
    poolPlay.picks[index] = safeDigit
  },
  /** 彩池玩法：設定單注金額 */
  setPoolAmount: (money: number) => {
    poolPlay.amount = Math.max(0, Math.trunc(Number(money) || 0))
  },
  /** 彩池玩法：隨機選滿全部槽位 */
  randomPool: () => {
    poolPlay.picks = poolPlay.picks.map(() => Math.floor(Math.random() * 10))
    return poolPlay.picks.length
  },
  clearPool: () => {
    poolPlay.picks = poolPlay.picks.map(() => null)
  }
}

// ── Fetch ──────────────────────────────────────────────────────────────────
const fetch = {
  /** 爆池狀態（看板附加資訊，取不到就維持舊值，不蓋掉主要流程的錯誤訊息） */
  creditJackpot: async () => {
    try {
      Object.assign(creditJackpot, await api.lottery.jackpotEggs())
    } catch {
      // 靜默：爆池只是顯示用
    }
  },
  /** 彩池玩法（選號）狀態——與上面的爆池是兩個獨立的池 */
  poolState: async () => {
    try {
      Object.assign(poolPlayState, await api.lottery.poolEggs())
    } catch {
      // 靜默：彩池玩法狀態只是顯示用
    }
  },
  refreshCurrentInfo: async () => {
    try {
      const result = await api.lottery.currentEggs()
      if (!result) return
      current.runtime = result
      time.syncedAtServerMs = Date.now()
      time.syncedAtClientMs = Date.now()
      time.statusEndAt = Number(result.statusEndAt ?? 0)
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
      const res = await api.lottery.userRecordEggs()
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
      const res = await api.lottery.openCodeHistoryEggs()
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
      const res = await api.lottery.claimOneIssueEggs()
      if (res?.ok) {
        wallet.coin = Number(res.coin ?? wallet.coin)
        await fetch.userRecordAll()
      }
      return res
    } finally {
      userRecord.isSubmittingClaim = false
    }
  },
  /** 投注：以當前選取的注項送單 */
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
   * 投注：彩池玩法（選號）
   * 固定 EGGS_POOL_PICK_COUNT 碼一注（可重複），賠率概念不適用（依命中顆數分層派彩，見伺端結算）。
   */
  betsPool: async () => {
    if (!poolPlayReady.value) {
      state.message = `請選滿 ${EGGS_POOL_PICK_COUNT} 個數字`
      return { ok: false, message: state.message }
    }
    const coin = Math.max(0, Math.trunc(Number(poolPlay.amount) || 0))
    if (!(coin > 0)) {
      state.message = '請填入單注金額'
      return { ok: false, message: state.message }
    }
    return fetch.submit(
      [{
        playKey: EGGS_POOL_PLAY_KEY,
        playTypeName: '選號（彩池）',
        selectTabId: 0,
        playList: [{ codes: poolPlay.picks as number[], amount: coin }]
      }],
      coin
    )
  },
  /**
   * 自動投注：從當前分頁的注項池隨機取 count 項，各下 amount 元
   * 直接組 payload 送單，不經由 select.items —— 這樣不會覆蓋使用者手動填的注項。
   * ⚠️ 彩池玩法沒有 select.pool，固定選滿槽位、固定一注，count 忽略。
   */
  autoBets: async ({ count, amount }: { count: number; amount: number }) => {
    if (isPoolPlay.value) {
      const coin = Math.max(0, Math.trunc(Number(amount) || 0))
      if (!(coin > 0)) return { ok: false, message: '請填入投注金額', count: 0, amount: 0 }
      poolPlay.amount = coin
      _actions.randomPool()
      const result = await fetch.betsPool()
      return { ...result, count: 1, amount: coin }
    }
    const pool = select.pool
    if (pool.length === 0) return { ok: false, message: '注項尚未載入', count: 0, amount: 0 }
    const coin = Math.max(0, Math.trunc(Number(amount) || 0))
    if (!(coin > 0)) return { ok: false, message: '請填入投注金額', count: 0, amount: 0 }
    const size = Math.max(1, Math.min(Math.trunc(Number(count) || 1), pool.length))

    const shuffled = [...pool]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = shuffled[i] as EggsSelectItem
      shuffled[i] = shuffled[j] as EggsSelectItem
      shuffled[j] = tmp
    }
    const picked = shuffled.slice(0, size)

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
      _actions.clearPool()
      select.resetToken += 1
      // 送單成功一律刷新餘額、注單、爆池與彩池玩法狀態（自動下注是直接呼叫 fetch.submit，不經手動投注流程）
      // ⚠️ 爆池／彩金池金額本來只在換期輪詢時才刷新，玩家下注後畫面看不到自己剛抽的水，這裡補上即時刷新
      await Promise.all([fetch.userInfo(), fetch.userRecordAll(), fetch.creditJackpot(), fetch.poolState()])
      return { ok: true, message: state.message, count: ((result as any)?.orders ?? []).length, amount }
    } catch (error) {
      state.submitStatus = 'error'
      const err = error as any
      state.errorMessage = String(
        err?.data?.message ?? err?.data?.statusMessage ?? (error instanceof Error ? error.message : '下注失敗')
      )
      const isLoginExpired = err?.data?.data?.code === STATUS_ERR_CODE[40001].code
        || err?.data?.statusCode === STATUS_ERR_CODE[40001].httpStatus
        || err?.statusCode === STATUS_ERR_CODE[40001].httpStatus
      return { ok: false, message: state.errorMessage, loginExpired: isLoginExpired }
    }
  },
  initPageData: async () => {
    state.fetchStatus = 'loading'
    await Promise.all([
      fetch.refreshCurrentInfo(), fetch.userInfo(), fetch.openCodeHistoryAll(),
      fetch.creditJackpot(), fetch.poolState()
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
          // 期別換了代表上一期已開獎：注單結果、可領獎金、開獎歷史、彩池玩法狀態一起刷新
          current.detail = []
          fetch.userRecordAll()
          fetch.openCodeHistoryAll()
          fetch.creditJackpot()
          fetch.poolState()
        })
      }, 3000)
    }
  },
  stopPolling: () => {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }
}

export function useEggs() {
  return {
    state,
    current,
    creditJackpot,
    poolPlay,
    poolPlayState,
    select,
    wallet,
    time,
    userRecord,
    openCodeHistory,

    lotteryMeta,
    playList,
    groupList,
    currentQuota,
    selectedCount,
    isPoolPlay,
    poolPlayReady,
    totalAmount,
    isOpen,
    canSubmit,

    actions: _actions,
    fetch,
    /** 玩法定義（供玩法列表對帳） */
    playDefinitions: EGGS_PLAY_DEFINITIONS,
    /** 注項賠率查詢（依分頁 rtp 即時推算） */
    oddsOf: eggsTabOddsOf,
    /** 彩池玩法固定選號數（供 Picker 顯示槽位數） */
    poolPickCount: EGGS_POOL_PICK_COUNT
  }
}
