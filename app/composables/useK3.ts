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
import C_OG_PLAYS from '#shared/config/k3og/plays'
import {
  findK3OgTab,
  k3OgComboOf,
  k3OgExpandCombo,
  k3OgQuotaOf,
  k3OgTabOddsOf
} from '#shared/config/k3og/helpers'

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

/**
 * 投注模式（對齊 pcv2_0223 的 MODE_BET）
 *   normal —— 每個注項各自填金額；點注項那一列不切換選取（有金額才算選中）
 *   fast   —— 點注項即選取並套用共用金額；沒有逐項金額欄
 */

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
  /** 投注金額：點注項時套用這個值，也可在看板逐項改 */
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

/**
 * 官方盤賠率玩法（k3og）的選號狀態
 *
 * 官方盤有兩套派彩並存：
 *   彩池玩法（playKey = POOL_PLAY_KEY）→ 選 3 個點數，走 ofPicks 與 fetch.betsOf()
 *   賠率玩法（k3og 的 6 個）           → 走這一組與 fetch.betsOg()
 * 單選分頁把注項收在 items（一注一項）；組合分頁（三不同號／二不同號）只記使用者
 * 點了哪些點數，注碼在送單前才用 k3OgExpandCombo() 展開。
 */
const OG_POOL_PLAY_KEY = 'xuanhao'
const ogPlays = C_OG_PLAYS as Array<{ key?: string; name?: string; list?: any[] }>
const og = reactive({
  /** 當前玩法 key；OG_POOL_PLAY_KEY 代表切到彩池玩法 */
  play: String(ogPlays[0]?.key ?? ''),
  tabId: Number(ogPlays[0]?.list?.[0]?.tabId ?? 0),
  tabName: String(ogPlays[0]?.list?.[0]?.tabName ?? ''),
  /** 單選分頁已選注項：注碼 → 金額 */
  items: [] as Array<{ code: string; odds: number; coin: number }>,
  /** 組合分頁：標準選的點數 */
  nums: [] as number[],
  /** 組合分頁：膽碼／拖碼 */
  dan: [] as number[],
  tuo: [] as number[]
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

// ── 官方盤賠率玩法（k3og）───────────────────────────────────────────────────
/** 玩法清單（含最後一個彩池玩法，讓兩套派彩共用同一排分頁） */
const ogPlayList = computed(() => [
  ...ogPlays.map((play) => ({ key: String(play.key ?? ''), name: String(play.name ?? ''), isPool: false })),
  { key: OG_POOL_PLAY_KEY, name: '選號（彩池）', isPool: true }
])
/** 是否切在彩池玩法 */
const isOgPool = computed(() => og.play === OG_POOL_PLAY_KEY)
/** 當前玩法的分頁清單 */
const ogTabList = computed(() => (isOgPool.value ? [] : ogPlays.find((play) => play.key === og.play)?.list ?? []))
/** 當前分頁的群組（單選分頁＝注項、組合分頁＝可選點數） */
const ogGroups = computed(() => findK3OgTab(og.play, og.tabId)?.tabGroup ?? [])
/** 當前分頁的組合規則；單選分頁回 null */
const ogCombo = computed(() => (isOgPool.value ? null : k3OgComboOf(og.play, og.tabId)))
/** 當前分頁限額 */
const ogQuota = computed(() => k3OgQuotaOf(og.play, og.tabId))
/**
 * 組合分頁展開後的注碼（一注一碼）
 * 標準：C(選的點數, pick)；膽拖：C(拖碼, pick − 膽碼)
 */
const ogComboCodes = computed(() => {
  if (!ogCombo.value) return []
  return k3OgExpandCombo(og.play, og.tabId, { nums: og.nums, dan: og.dan, tuo: og.tuo })
})
/** 已選注數：單選＝有金額的注項數、組合＝展開後的注數 */
const ogSelectedCount = computed(() =>
  ogCombo.value ? ogComboCodes.value.length : og.items.filter((item) => Number(item.coin) > 0).length
)
/** 總投注額：組合玩法每一注都用同一個金額（state.amount） */
const ogTotalAmount = computed(() => {
  if (ogCombo.value) return Number((ogComboCodes.value.length * Number(state.amount || 0)).toFixed(2))
  return Number(og.items.reduce((sum, item) => sum + Number(item.coin ?? 0), 0).toFixed(2))
})
/**
 * 官方盤自動投注的注碼池
 *
 * 單選分頁 → 該分頁所有注碼；組合分頁 → 全選 1~6 展開後的所有組合；彩池 → 只有 1 注。
 * Auto 元件用它算注數上限，也用來判斷「玩法載入了沒」。
 */
const ogAutoCodes = computed(() => {
  if (isOgPool.value) return ['選號']
  const combo = k3OgComboOf(og.play, og.tabId)
  if (combo) return k3OgExpandCombo(og.play, og.tabId, { nums: [1, 2, 3, 4, 5, 6], dan: [], tuo: [] })
  return ((findK3OgTab(og.play, og.tabId)?.tabGroup ?? []) as any[])
    .flatMap((group) => (group.groupList ?? []).map((option: any) => String(option?.name ?? '')))
    .filter((code) => code.length > 0)
})

/** 賠率玩法可否送單 */
const canSubmitOg = computed(() =>
  isOpen.value && state.submitStatus !== 'loading' && ogSelectedCount.value > 0 && ogTotalAmount.value > 0
)
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

/**
 * 重算「當前注項」
 * 與 pcv2 的 car.getSelectedItems() 同一條：isactive || money > 0
 * —— normal 模式只填金額不點選也算選中，fast 模式點選即帶入共用金額
 */
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
  /** 切換盤口：注項語意不同，必須清掉選取 */
  setMode: (mode: K3Mode) => {
    if (state.mode === mode) return
    state.mode = mode
    _actions.clearSelect()
    _actions.clearOg()
    ofPicks.list = [0, 0, 0]
    /*
     * 切盤口要把上一盤的資料清掉。
     *
     * 伺端本來就分開存（K3-CD 用 user.k3Record、K3-OF 用 user.k3OfRecord），
     * 但這個 composable 是 module 級單例，userRecord / current.detail 只有一份 ——
     * 不清的話，從 k3-cd 走到 k3-of 的那幾百毫秒（新的 userRecordAll 還沒回來），
     * 下注紀錄與當期注單會顯示「上一個盤口」的內容。
     */
    userRecord.balanceChanges = []
    userRecord.betHistory = []
    userRecord.claimableIssues = []
    userRecord.errorMessage = ''
    current.detail = []
    openCodeHistory.list = []
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
  // ── 官方盤賠率玩法 ────────────────────────────────────────────────────────
  /** 切換玩法：兩套派彩語意不同，一律先清掉選取 */
  setOgPlay: (playKey: string) => {
    if (og.play === playKey) return
    og.play = playKey
    const firstTab = ogPlays.find((play) => play.key === playKey)?.list?.[0]
    og.tabId = Number(firstTab?.tabId ?? 0)
    og.tabName = String(firstTab?.tabName ?? '')
    _actions.clearOg()
  },
  /** 切換分頁（標準 ↔ 膽拖也走這裡） */
  setOgTab: (tabId: number | string) => {
    const tab = findK3OgTab(og.play, tabId)
    if (!tab) return
    og.tabId = Number(tab.tabId)
    og.tabName = String(tab.tabName ?? '')
    _actions.clearOg()
  },
  /** 單選分頁：點注項切換選取，選取時套用投注金額 */
  toggleOgItem: (code: string) => {
    const key = String(code ?? '').trim()
    if (!key) return
    const idx = og.items.findIndex((item) => item.code === key)
    if (idx >= 0) {
      og.items.splice(idx, 1)
      return
    }
    const quota = k3OgQuotaOf(og.play, og.tabId).item
    og.items.push({
      code: key,
      odds: k3OgTabOddsOf(og.play, og.tabId, key),
      coin: Math.min(quota.max, Math.max(quota.min, Math.trunc(Number(state.amount) || 0)))
    })
  },
  /** 單選分頁：逐項改金額（0 視為取消該注） */
  setOgItemCoin: (code: string, coin: number) => {
    const item = og.items.find((row) => row.code === String(code))
    if (!item) return
    const quota = k3OgQuotaOf(og.play, og.tabId).item
    item.coin = Math.min(quota.max, Math.max(0, Math.trunc(Number(coin) || 0)))
  },
  /** 組合分頁：切換點數（bucket 決定是標準的 nums 還是膽拖的 dan／tuo） */
  toggleOgPoint: (bucket: 'nums' | 'dan' | 'tuo', point: number) => {
    const num = Math.trunc(Number(point) || 0)
    if (!(num >= 1 && num <= K3_DICE_MAX)) return
    const list = og[bucket]
    const idx = list.indexOf(num)
    if (idx >= 0) {
      list.splice(idx, 1)
      return
    }
    // 膽碼有上限（至少要留一個拖碼），超過就不再加
    const combo = k3OgComboOf(og.play, og.tabId)
    if (bucket === 'dan' && combo?.maxDan && list.length >= combo.maxDan) return
    // 同一個點數不能同時是膽碼與拖碼
    if (bucket === 'dan') og.tuo = og.tuo.filter((item) => item !== num)
    if (bucket === 'tuo') og.dan = og.dan.filter((item) => item !== num)
    list.push(num)
    list.sort((a, b) => a - b)
  },
  /**
   * 官方盤隨機選號
   *
   * 三種分頁的語意不同（count 一律當「目標注數」）：
   *   單選分頁 —— 從該分頁所有注項隨機挑 count 個（正好 count 注）
   *   組合分頁 —— 隨機挑點數，挑到「展開後的注數 ≥ count」為止（最多 6 個點數）；
   *               膽拖固定先挑 1 個膽碼，再逐步補拖碼
   *   彩池玩法 —— 走 randomOfPicks()（隨機 3 個點數 = 1 注）
   * ⚠️ 組合分頁的注數是組合數，不見得剛好等於 count（例如三不同號選 4 個點數就是 4 注），
   *    所以是「至少 count 注」。實際注數由看板與當前注項顯示。
   * @returns 實際選出的注數
   */
  randomOgSelect: (count: number) => {
    if (og.play === OG_POOL_PLAY_KEY) {
      _actions.randomOfPicks()
      return 1
    }
    const size = Math.max(1, Math.trunc(Number(count) || 1))
    const shuffle = <T>(list: T[]) => {
      const pool = [...list]
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = pool[i] as T
        pool[i] = pool[j] as T
        pool[j] = tmp
      }
      return pool
    }
    _actions.clearOg()

    const combo = k3OgComboOf(og.play, og.tabId)
    if (!combo) {
      const codes = ((findK3OgTab(og.play, og.tabId)?.tabGroup ?? []) as any[])
        .flatMap((group) => (group.groupList ?? []).map((option: any) => String(option?.name ?? '')))
        .filter((code) => code.length > 0)
      shuffle(codes).slice(0, Math.min(size, codes.length)).forEach((code) => _actions.toggleOgItem(code))
      return og.items.length
    }

    const points = shuffle([1, 2, 3, 4, 5, 6])
    const expanded = () => k3OgExpandCombo(og.play, og.tabId, { nums: og.nums, dan: og.dan, tuo: og.tuo }).length
    if (combo.mode === 'standard') {
      for (let take = combo.pick; take <= points.length; take++) {
        og.nums = points.slice(0, take).sort((a, b) => a - b)
        if (expanded() >= size) break
      }
    } else {
      const danCount = Math.min(combo.maxDan ?? combo.pick - 1, 1)
      og.dan = points.slice(0, danCount).sort((a, b) => a - b)
      for (let take = combo.pick - danCount; danCount + take <= points.length; take++) {
        og.tuo = points.slice(danCount, danCount + take).sort((a, b) => a - b)
        if (expanded() >= size) break
      }
    }
    return expanded()
  },
  /** 取注碼賠率（依當前玩法／分頁的 rtp 即時推算，看板顯示用） */
  ogOddsOf: (code: string) => k3OgTabOddsOf(og.play, og.tabId, String(code ?? '')),
  /** 清空賠率玩法的選取 */
  clearOg: () => {
    og.items = []
    og.nums = []
    og.dan = []
    og.tuo = []
  },
  /** 點注項：切換選取，選取時套用投注金額（同 6hc-cd 的 click.toggle） */
  toggleItem: (playId: string | number) => {
    const item = select.pool.find((option) => String(option.playId) === String(playId))
    if (!item) return
    item.select = !item.select
    item.coin = item.select ? Math.max(0, Math.trunc(Number(state.amount) || 0)) : 0
    _syncSelectItems()
  },
  /** 設定投注金額，並同步已選注項（同 6hc-cd 對 mxState.amount 的 watch） */
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
      const tmp = shuffled[i] as K3SelectItem
      shuffled[i] = shuffled[j] as K3SelectItem
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
  },

  /**
   * 注碼的顯示名稱
   *
   * 點數（和值）的注碼是純數字「3」～「18」，單看數字容易被誤認成骰子點數或號碼球，
   * 所以畫面一律補上「點」。⚠️ 只影響顯示 —— 送伺端與結算的注碼仍是原本的 name。
   */
  labelOf: (betCode: string | number) => {
    const code = String(betCode ?? '')
    return /^\d+$/.test(code) ? `${code}點` : code
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
  /**
   * 自動投注：從當前分頁的注項池隨機取 count 項，各下 amount 元
   *
   * 直接組 payload 送單，不經由 select.items —— 這樣不會覆蓋使用者手動填的注項。
   * ⚠️ 送單成功後 submit 會清空選取（與手動下注一致）。
   */
  autoBets: async ({ count, amount }: { count: number; amount: number }) => {
    const pool = select.pool
    if (pool.length === 0) return { ok: false, message: '注項尚未載入', count: 0, amount: 0 }
    const coin = Math.max(0, Math.trunc(Number(amount) || 0))
    if (!(coin > 0)) return { ok: false, message: '請填入投注金額', count: 0, amount: 0 }
    const size = Math.max(1, Math.min(Math.trunc(Number(count) || 1), pool.length))

    const shuffled = [...pool]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = shuffled[i] as K3SelectItem
      shuffled[i] = shuffled[j] as K3SelectItem
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
  /**
   * 官方盤賠率玩法投注
   *
   * 單選分頁：每個有金額的注項各一注。
   * 組合分頁：展開後的每一注都用同一個金額（state.amount）。
   * ⚠️ 注碼與賠率伺端都會重新驗一次（k3OgHasBetCode / k3OgTabOddsOf），前端送的只是意圖。
   */
  betsOg: async () => {
    const combo = k3OgComboOf(og.play, og.tabId)
    const quota = k3OgQuotaOf(og.play, og.tabId).item
    const playList: Array<{ label: string; amount: number }> = []

    if (combo) {
      const codes = k3OgExpandCombo(og.play, og.tabId, { nums: og.nums, dan: og.dan, tuo: og.tuo })
      if (codes.length === 0) {
        state.message = combo.mode === 'dantuo'
          ? `膽碼 1 ~ ${combo.maxDan ?? combo.pick - 1} 個，加上拖碼要能組成 ${combo.pick} 個點數`
          : `請選至少 ${combo.pick} 個不同點數`
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

    const total = Number(playList.reduce((sum, row) => sum + row.amount, 0).toFixed(2))
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
   * 依當前分頁型態決定怎麼隨機：
   *   彩池玩法 → 隨機 3 個點數（固定 1 注）
   *   組合分頁 → 隨機挑點數，展開到注數 ≥ count（最多 6 個點數，故為「至少 count 注」）
   *   單選分頁 → 從該分頁注碼隨機取 count 個
   * ⚠️ 送單成功後 submit 會清空選取（與手動下注一致）。
   */
  autoBetsOg: async ({ count, amount }: { count: number; amount: number }) => {
    const coin = Math.max(0, Math.trunc(Number(amount) || 0))
    if (!(coin > 0)) return { ok: false, message: '請填入投注金額', count: 0, amount: 0 }
    const size = Math.max(1, Math.trunc(Number(count) || 1))
    const shuffle = <T>(list: T[]) => {
      const pool = [...list]
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = pool[i] as T
        pool[i] = pool[j] as T
        pool[j] = tmp
      }
      return pool
    }

    // 彩池玩法：一注 = 3 個點數
    if (isOgPool.value) {
      const picks = Array.from({ length: K3_OF_PICK_COUNT }, () => 1 + Math.floor(Math.random() * K3_DICE_MAX))
      const result = await fetch.submit(
        [{
          playKey: 'xuanhao',
          playTypeName: '選號',
          playList: [{ codes: picks.map(String), amount: coin, label: picks.join(',') }]
        }],
        coin
      )
      return { ...result, count: 1, amount: coin }
    }

    const combo = k3OgComboOf(og.play, og.tabId)
    let codes: string[] = []
    if (combo) {
      const points = shuffle([1, 2, 3, 4, 5, 6])
      for (let take = combo.pick; take <= points.length; take++) {
        codes = k3OgExpandCombo(og.play, og.tabId, { nums: points.slice(0, take) })
        if (codes.length >= size) break
      }
    } else {
      codes = shuffle(ogAutoCodes.value).slice(0, Math.min(size, ogAutoCodes.value.length))
    }
    if (codes.length === 0) return { ok: false, message: '此分頁無法自動選號', count: 0, amount: 0 }

    const result = await fetch.submit(
      [{
        playKey: og.play,
        playTypeName: og.tabName,
        selectTabId: og.tabId,
        playList: codes.map((code) => ({ label: code, amount: coin }))
      }],
      Number((codes.length * coin).toFixed(2))
    )
    return { ...result, count: codes.length, amount: Number((codes.length * coin).toFixed(2)) }
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
          if (String(current.runtime?.issueLatest ?? '') === before) return
          // 期別換了代表上一期已開獎：注單結果、可領獎金、開獎歷史一起刷新
          current.detail = []
          fetch.userRecordAll()
          // 開獎歷史原本只在 initPageData 抓一次 —— 不補這行，近五期開獎／路單走勢／
          // 開獎歷史彈窗都會停在進頁那一刻，要重新整理才看得到新開的一期
          fetch.openCodeHistoryAll()
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

    /** 官方盤賠率玩法（k3og） */
    og,
    ogPlayList,
    ogTabList,
    ogGroups,
    ogCombo,
    ogQuota,
    ogComboCodes,
    ogSelectedCount,
    ogTotalAmount,
    ogAutoCodes,
    canSubmitOg,
    isOgPool,

    actions: _actions,
    fetch,
    /** 玩法定義（供玩法列表對帳） */
    playDefinitions: K3_PLAY_DEFINITIONS,
    /** 注項賠率查詢（依分頁 rtp 即時推算） */
    oddsOf: k3TabOddsOf
  }
}
