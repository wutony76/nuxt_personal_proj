import { computed, reactive, watch } from 'vue'
import { LOTTERY, STATUS_TIME, STATUS_ERR_CODE } from '~/config/constants'
import {
  api,
  type Pk10Current,
  type Pk10Pool,
  type Pk10UserBetHistory,
  type LotteryUserBalanceChange,
  type LotteryClaimableIssue,
  type LotteryOpenCodeHistoryItem
} from '~/services/api'
import { judgePk10Bet, PK10_PLAY_DEFINITIONS } from '#shared/config/pk10-cd'
import {
  pk10CarsOf,
  pk10CarCode,
  pk10SumOf,
  PK10_CAR_COUNT,
  PK10_RANK_NAMES
} from '#shared/config/pk10'
import {
  pk10FirstTwoCode,
  PK10_OF_PICK_COUNT,
  PK10_OF_PRIZE_TIERS
} from '#shared/config/pk10-of'
import C_PLAYS from '#shared/config/pk10cd/plays'
import { findPk10Tab, pk10QuotaOf, pk10TabOddsOf } from '#shared/config/pk10cd/helpers'
import C_OG_PLAYS from '#shared/config/pk10og/plays'
import {
  findPk10OgTab,
  pk10OgComboGroups,
  pk10OgComboOf,
  pk10OgExpandCombo,
  pk10OgIsPoolTab,
  pk10OgQuotaOf,
  pk10OgTabOddsOf
} from '#shared/config/pk10og/helpers'

/**
 * PK10 前端狀態（PK10-CD 信用盤 / PK10-OF 官方盤共用一支）
 *
 * ── 為什麼兩個盤口共用一支 composable ────────────────────
 *   兩邊的期別、倒數、開獎名次、彩池都來自伺端的同一份共用狀態
 *   （server/services/game/lottery/bg/pk10Shared.ts），前端沒有理由拆成兩份互相打架。
 *   差異只有「注項怎麼選」與「怎麼派彩」：
 *     mode = 'cd' → 讀 shared/config/pk10cd 的注項，按賠率派彩
 *     mode = 'of' → 讀 shared/config/pk10og，前三直選走彩池分層、其餘走賠率
 *
 * ── 投注區完全由 config 驅動 ────────────────────────────
 *   玩法列、分頁列、群組、注項、限額、賠率全部從 shared/config/pk10cd|pk10og 讀，
 *   看板元件只負責畫 groupList，不寫死任何玩法 —— 這樣改 config 就等於改畫面。
 *   （設定內容照 pcv2_0223 的 conf_pk10_cd.js / conf_pk10_og.js 提取）
 *
 * ⚠️ state 是 module 級單例（與 useK3 相同做法），
 *    切換盤口時務必呼叫 actions.setMode() 重置選取，否則會把 CD 的注項帶進 OF。
 */

export type Pk10Mode = 'cd' | 'of'

/** 看板注項（由 config tabGroup.groupList 複製而來，select / coin 為前端選取狀態） */
export type Pk10SelectItem = {
  playId: string | number
  name: string | number
  odds?: number
  coin?: string | number
  select?: boolean
  /** 定位膽／兩面：該注項的車號（畫號碼球用） */
  car?: number
  /** 定位膽：該注項屬於第幾個名次 */
  rank?: number
  /** 冠亞組合：兩個車號 */
  pair?: number[]
}

type ConfigPlay = { key?: string; name?: string; list?: any[] }

const cdPlays = C_PLAYS as ConfigPlay[]
const ogPlays = C_OG_PLAYS as ConfigPlay[]

// ── Module-level singletons ────────────────────────────────────────────────
const state = reactive({
  mode: 'cd' as Pk10Mode,
  /** 信用盤：當前玩法（dingwei / liangmian / zuhe / guanyahe / longhu） */
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
  runtime: null as Pk10Current | null,
  /** 當期自己的注單（下注成功後本地追加，開獎後由 user-record 覆蓋） */
  detail: [] as Array<{ orderId: string; betCode: string[]; coin: number; odds?: number; time: string }>
})

const pool = reactive<Pk10Pool>({ issue: '', base: 0, carry: 0, issuePool: 0, distributable: 0 })

const select = reactive({
  items: [] as Pk10SelectItem[],
  pool: [] as Pk10SelectItem[],
  show: true,
  resetToken: 0
})

/**
 * 官方盤（pk10og）的選號狀態
 *
 * 兩種分頁型態：
 *   單選分頁（前一直選／定位膽）→ items：注碼 → 金額
 *   複式分頁（前二／前三直選）  → picks：每個名次選了哪些車號，送單前才展開
 */
const og = reactive({
  play: String(ogPlays[0]?.key ?? ''),
  tabId: Number(ogPlays[0]?.list?.[0]?.tabId ?? 0),
  tabName: String(ogPlays[0]?.list?.[0]?.tabName ?? ''),
  /** 單選分頁已選注項 */
  items: [] as Array<{ code: string; odds: number; coin: number }>,
  /** 複式分頁：picks[pos] = 該名次選的車號 */
  picks: [] as number[][]
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
  betHistory: [] as Pk10UserBetHistory[],
  claimableIssues: [] as LotteryClaimableIssue[]
})

const openCodeHistory = reactive({
  isLoading: false,
  errorMessage: '',
  list: [] as LotteryOpenCodeHistoryItem[]
})

// ── Computed：共用 ─────────────────────────────────────────────────────────
const isCd = computed(() => state.mode === 'cd')
const lotteryMeta = computed(() => (isCd.value ? LOTTERY['PK10-CD'] : LOTTERY['PK10-OF']))
const isOpen = computed(() => String(current.runtime?.currentStatus ?? '') === STATUS_TIME.OPEN)

// ── Computed：信用盤 ───────────────────────────────────────────────────────
/** 玩法清單（直接就是 config，畫面照這個渲染玩法列） */
const playList = computed(() => cdPlays)
/** 當前玩法的分頁清單 */
const groupList = computed(() => playList.value.find((play) => play.key === state.select)?.list ?? [])
/** 當前分頁的群組（看板照這個畫，一群一列標題） */
const tabGroups = computed(() => findPk10Tab(state.select, state.selectTabId)?.tabGroup ?? [])
/** 當前分頁限額 */
const currentQuota = computed(() => pk10QuotaOf(state.select, state.selectTabId))
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
/** 玩法清單（含「這個玩法走不走彩池」，畫面用來標記前三直選） */
const ogPlayList = computed(() => ogPlays.map((play) => ({
  key: String(play.key ?? ''),
  name: String(play.name ?? ''),
  isPool: Boolean(play.list?.[0]?.combo?.pool)
})))
/** 當前玩法的分頁清單 */
const ogTabList = computed(() => ogPlays.find((play) => play.key === og.play)?.list ?? [])
/** 當前分頁的群組（單選分頁＝注項清單） */
const ogGroups = computed(() => findPk10OgTab(og.play, og.tabId)?.tabGroup ?? [])
/** 當前分頁的複式規則；單選分頁回 null */
const ogCombo = computed(() => pk10OgComboOf(og.play, og.tabId))
/** 複式分頁每個名次可選的車號（看板畫選號格用） */
const ogComboGroups = computed(() => pk10OgComboGroups(og.play, og.tabId))
/** 當前分頁是不是走彩池分層（前三直選） */
const ogIsPool = computed(() => pk10OgIsPoolTab(og.play, og.tabId))
/** 當前分頁限額 */
const ogQuota = computed(() => pk10OgQuotaOf(og.play, og.tabId))
/** 複式展開後的每一注（車號陣列，順序即名次） */
const ogComboBets = computed(() => {
  if (!ogCombo.value) return [] as number[][]
  return pk10OgExpandCombo(og.play, og.tabId, og.picks)
})
/** 已選注數：單選＝有金額的注項數、複式＝展開後的注數 */
const ogSelectedCount = computed(() =>
  ogCombo.value ? ogComboBets.value.length : og.items.filter((item) => Number(item.coin) > 0).length
)
/** 總投注額：複式的每一注都用同一個金額（state.amount） */
const ogTotalAmount = computed(() => {
  if (ogCombo.value) return Number((ogComboBets.value.length * Number(state.amount || 0)).toFixed(2))
  return Number(og.items.reduce((sum, item) => sum + Number(item.coin ?? 0), 0).toFixed(2))
})
const canSubmitOg = computed(() =>
  isOpen.value && state.submitStatus !== 'loading' && ogSelectedCount.value > 0 && ogTotalAmount.value > 0
)
/** 前三直選的分層規則（命中幾個名次要開獎後才知道，這裡只顯示規則） */
const ofPrizeTiers = computed(() => PK10_OF_PRIZE_TIERS)
/**
 * 官方盤自動投注的注碼池
 * 單選分頁 → 該分頁所有注碼；複式分頁 → 用「全選」展開後的注數當上限
 */
const ogAutoCodes = computed(() => {
  if (ogCombo.value) {
    const all = Array.from({ length: PK10_CAR_COUNT }, (_, i) => i + 1)
    return pk10OgExpandCombo(og.play, og.tabId, Array.from({ length: ogCombo.value.positions }, () => all))
      .map((cars) => cars.join(','))
  }
  return (ogGroups.value as any[])
    .flatMap((group) => (group.groupList ?? []).map((option: any) => String(option?.name ?? '')))
    .filter((code) => code.length > 0)
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

/** 把複式的 picks 重設成「每個名次一個空陣列」 */
function _resetOgPicks() {
  const positions = Number(pk10OgComboOf(og.play, og.tabId)?.positions ?? 0)
  og.picks = Array.from({ length: positions }, () => [])
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
  /** 切換盤口：注項語意不同，必須清掉選取 */
  setMode: (mode: Pk10Mode) => {
    if (state.mode === mode) return
    state.mode = mode
    _actions.clearSelect()
    _actions.clearOg()
    /*
     * 切盤口要把上一盤的資料清掉。
     *
     * 伺端本來就分開存（PK10-CD 用 user.pk10Record、PK10-OF 用 user.pk10OfRecord），
     * 但這個 composable 是 module 級單例，userRecord / current.detail 只有一份 ——
     * 不清的話，從 pk10-cd 走到 pk10-of 的那幾百毫秒（新的 userRecordAll 還沒回來），
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
    const tab = findPk10Tab(state.select, tabId)
    if (!tab) return
    state.selectTabId = Number(tab.tabId)
    state.selectTabName = String(tab.tabName)
    select.items = []
    select.pool = []
    select.resetToken += 1
  },
  /** 看板初始化時登記當前分頁所有注項（同一批 reactive 物件，改 select / coin 會反映到畫面） */
  registerSelectPool: (items: Pk10SelectItem[]) => {
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
    const tab = findPk10OgTab(og.play, tabId)
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
    const quota = pk10OgQuotaOf(og.play, og.tabId).item
    og.items.push({
      code: key,
      odds: pk10OgTabOddsOf(og.play, og.tabId, key),
      coin: Math.min(quota.max, Math.max(quota.min, Math.trunc(Number(state.amount) || 0)))
    })
  },
  /** 單選分頁：逐項改金額（0 視為取消該注） */
  setOgItemCoin: (code: string, coin: number) => {
    const item = og.items.find((row) => row.code === String(code))
    if (!item) return
    const quota = pk10OgQuotaOf(og.play, og.tabId).item
    item.coin = Math.min(quota.max, Math.max(0, Math.trunc(Number(coin) || 0)))
  },
  /** 複式分頁：切換第 pos 個名次的某個車號 */
  toggleOgPick: (pos: number, car: number) => {
    const positions = Number(pk10OgComboOf(og.play, og.tabId)?.positions ?? 0)
    const idx = Math.trunc(Number(pos))
    const value = Math.trunc(Number(car) || 0)
    if (!(idx >= 0 && idx < positions)) return
    if (!(value >= 1 && value <= PK10_CAR_COUNT)) return
    if (og.picks.length !== positions) _resetOgPicks()
    const list = og.picks[idx] as number[]
    const at = list.indexOf(value)
    if (at >= 0) list.splice(at, 1)
    else {
      list.push(value)
      list.sort((a, b) => a - b)
    }
  },
  /** 複式分頁：某個名次全選 / 全清 */
  toggleOgPickAll: (pos: number) => {
    const positions = Number(pk10OgComboOf(og.play, og.tabId)?.positions ?? 0)
    const idx = Math.trunc(Number(pos))
    if (!(idx >= 0 && idx < positions)) return
    if (og.picks.length !== positions) _resetOgPicks()
    const cars = ogComboGroups.value.find((group) => group.pos === idx)?.cars ?? []
    const list = og.picks[idx] as number[]
    og.picks[idx] = list.length === cars.length ? [] : [...cars]
  },
  /**
   * 官方盤隨機選號（count 一律當「目標注數」）
   *   單選分頁 —— 從該分頁所有注項隨機挑 count 個（正好 count 注）
   *   複式分頁 —— 每個名次逐步多挑一個車號，挑到展開後注數 ≥ count 為止
   * ⚠️ 複式的注數是乘積，不見得剛好等於 count（例如前二各選 2 個就是 4 注），
   *    所以是「至少 count 注」。實際注數由看板與當前注項顯示。
   * @returns 實際選出的注數
   */
  randomOgSelect: (count: number) => {
    const size = Math.max(1, Math.trunc(Number(count) || 1))
    _actions.clearOg()
    const combo = pk10OgComboOf(og.play, og.tabId)
    if (!combo) {
      const codes = (ogGroups.value as any[])
        .flatMap((group) => (group.groupList ?? []).map((option: any) => String(option?.name ?? '')))
        .filter((code) => code.length > 0)
      _shuffle(codes).slice(0, Math.min(size, codes.length)).forEach((code) => _actions.toggleOgItem(code))
      return og.items.length
    }
    // 每個名次各準備一份洗好的車號，然後一輪一輪加寬
    const shuffled = Array.from({ length: combo.positions }, () => _shuffle(
      Array.from({ length: PK10_CAR_COUNT }, (_, i) => i + 1)
    ))
    for (let take = 1; take <= PK10_CAR_COUNT; take++) {
      og.picks = shuffled.map((list) => list.slice(0, take).sort((a, b) => a - b))
      if (pk10OgExpandCombo(og.play, og.tabId, og.picks).length >= size) break
    }
    return pk10OgExpandCombo(og.play, og.tabId, og.picks).length
  },
  /** 取注碼賠率（依當前玩法／分頁的 rtp 即時推算，看板顯示用；彩池分頁回 0） */
  ogOddsOf: (code: string) => pk10OgTabOddsOf(og.play, og.tabId, String(code ?? '')),
  clearOg: () => {
    og.items = []
    _resetOgPicks()
  },

  // ── 顯示輔助 ────────────────────────────────────────────────────────────
  /** 該注項照某組開獎會不會中（畫面標示用，與結算共用同一支判定） */
  judgeItem: (betCode: string, openCode: string[], odds = 0) => judgePk10Bet(betCode, openCode, 1, odds),
  /** 該期開獎的冠亞和 */
  sumOf: (openCode: string[]) => {
    const cars = pk10CarsOf(openCode)
    return cars ? pk10SumOf(cars) : 0
  },
  /**
   * 注碼的顯示名稱
   *
   * 注碼本身已經自帶前綴（冠軍05、和大單、組合01-02、前二05-03），
   * 直接顯示就看得懂，這裡只把複式展開的車號陣列轉成人看的字串。
   */
  labelOf: (betCode: string | number) => String(betCode ?? ''),
  /** 複式一注（車號陣列）→ 顯示字串：[5,3] → "05-03" */
  comboLabelOf: (cars: Array<number | string>) =>
    (Array.isArray(cars) ? cars : []).map((car) => pk10CarCode(Number(car))).join('-'),
  /** 名次索引（0 起算）→ 名次名稱 */
  rankNameOf: (index: number) => String(PK10_RANK_NAMES[Number(index)] ?? '')
}

// ── Fetch ──────────────────────────────────────────────────────────────────
const fetch = {
  refreshCurrentInfo: async () => {
    try {
      const result = isCd.value ? await api.lottery.currentPk10Cd() : await api.lottery.currentPk10Of()
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
      const res = isCd.value ? await api.lottery.userRecordPk10Cd() : await api.lottery.userRecordPk10Of()
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
        ? await api.lottery.openCodeHistoryPk10Cd()
        : await api.lottery.openCodeHistoryPk10Of()
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
      const res = isCd.value ? await api.lottery.claimOneIssuePk10Cd() : await api.lottery.claimOneIssuePk10Of()
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
   * 三種分頁形狀，注單 payload 也跟著不同：
   *   單選分頁（前一／定位膽）→ playList: [{ label: 注碼, amount }]
   *   複式賠率（前二）        → 展開後轉成 前二05-03 字串再送
   *   複式彩池（前三）        → 展開後直接送 codes 陣列（伺端走彩池分層）
   * ⚠️ 注碼與賠率伺端都會重新驗一次，前端送的只是意圖。
   */
  betsOf: async () => {
    const combo = pk10OgComboOf(og.play, og.tabId)
    const quota = pk10OgQuotaOf(og.play, og.tabId).item
    const playList: Array<Record<string, unknown>> = []

    if (combo) {
      const bets = pk10OgExpandCombo(og.play, og.tabId, og.picks)
      if (bets.length === 0) {
        state.message = `請為每個名次都至少選一個車號（共 ${combo.positions} 個名次）`
        return { ok: false, message: state.message }
      }
      const coin = Math.min(quota.max, Math.max(quota.min, Math.trunc(Number(state.amount) || 0)))
      bets.forEach((cars) => {
        if (combo.pool) {
          // 彩池分頁：注碼是車號陣列，順序即名次
          playList.push({ codes: cars.map(String), amount: coin, label: _actions.comboLabelOf(cars) })
          return
        }
        const code = pk10FirstTwoCode(cars)
        if (code) playList.push({ label: code, amount: coin })
      })
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
   *   複式分頁 → 每個名次隨機挑車號，展開到注數 ≥ count（故為「至少 count 注」）
   */
  autoBetsOf: async ({ count, amount }: { count: number; amount: number }) => {
    const coin = Math.max(0, Math.trunc(Number(amount) || 0))
    if (!(coin > 0)) return { ok: false, message: '請填入投注金額', count: 0, amount: 0 }
    const size = Math.max(1, Math.trunc(Number(count) || 1))
    const combo = pk10OgComboOf(og.play, og.tabId)
    const playList: Array<Record<string, unknown>> = []

    if (combo) {
      const shuffled = Array.from({ length: combo.positions }, () => _shuffle(
        Array.from({ length: PK10_CAR_COUNT }, (_, i) => i + 1)
      ))
      let bets: number[][] = []
      for (let take = 1; take <= PK10_CAR_COUNT; take++) {
        bets = pk10OgExpandCombo(og.play, og.tabId, shuffled.map((list) => list.slice(0, take)))
        if (bets.length >= size) break
      }
      if (bets.length === 0) return { ok: false, message: '此分頁無法自動選號', count: 0, amount: 0 }
      bets.forEach((cars) => {
        if (combo.pool) {
          playList.push({ codes: cars.map(String), amount: coin, label: _actions.comboLabelOf(cars) })
          return
        }
        const code = pk10FirstTwoCode(cars)
        if (code) playList.push({ label: code, amount: coin })
      })
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
        err?.data?.statusMessage ?? err?.data?.message ?? (error instanceof Error ? error.message : '下注失敗')
      )
      /*
       * 登入失效：與 6hc / k3 一致 —— 標記出來讓呼叫端跳出提示並導回登入頁。
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

export function usePk10() {
  return {
    state,
    current,
    pool,
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
    ogComboBets,
    ogIsPool,
    ogQuota,
    ogSelectedCount,
    ogTotalAmount,
    ogAutoCodes,
    canSubmitOg,
    ofPrizeTiers,
    ofPickCount: PK10_OF_PICK_COUNT,

    actions: _actions,
    fetch,
    /** 玩法定義（供玩法列表對帳） */
    playDefinitions: PK10_PLAY_DEFINITIONS,
    /** 注項賠率查詢（依分頁 rtp 即時推算） */
    oddsOf: pk10TabOddsOf
  }
}
