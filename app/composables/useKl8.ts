import { computed, reactive, watch } from 'vue'
import { LOTTERY, STATUS_TIME, STATUS_ERR_CODE } from '~/config/constants'
import {
  api,
  type Kl8Current,
  type Kl8UserBetHistory,
  type CreditJackpotState,
  type PoolPlayState,
  type LotteryUserBalanceChange,
  type LotteryClaimableIssue,
  type LotteryOpenCodeHistoryItem
} from '~/services/api'
import {
  judgeKl8Bet,
  KL8_PLAY_DEFINITIONS,
  KL8_POOL_PLAY_KEY,
  KL8_POOL_PICK_COUNT,
  KL8_POOL_QUOTA
} from '#shared/config/kl8-cd'
import {
  kl8NumberLabel,
  kl8NumbersOf,
  kl8ParityZoneOf,
  kl8SumOf,
  kl8WuxingOf,
  kl8ZoneOf,
  KL8_NUMBERS
} from '#shared/config/kl8'
import C_PLAYS from '#shared/config/kl8cd/plays'
import { findKl8Tab, kl8ChosenOf, kl8QuotaOf, kl8TabOddsOf } from '#shared/config/kl8cd/helpers'

/**
 * 快樂8（KL8）前端狀態
 *
 * ── 與 useKl10 的差異：玩法只有兩個分頁 ────────────────────
 *   來源（bglottery `kl8/`）只有信用模式、沒有官方盤，也只有「任選」「兩面」兩個玩法分頁
 *   （沒有 kl10 的正和／龍虎鬥）。號碼池是 1~80、一期開 20 顆、無球位概念。
 *   「任選」與 kl10 同一套複式機制：先選 k 個號碼，再依 C(k, N) 展開成多注
 *   （做法與來源 `renxuan/play_script.js` 的 `doCalcCombination()` 相同），
 *   所以另外有 `renxuan` 狀態與 `fetch.betsRenxuan()`，不與表格看板的 select.pool 混用。
 *
 * ⚠️ state 是 module 級單例（與 useKl10 相同做法）。
 */

/** 看板注項（由 config tabGroup.groupList 複製而來，select / coin 為前端選取狀態） */
export type Kl8SelectItem = {
  playId: string | number
  name: string | number
  odds?: number
  coin?: string | number
  select?: boolean
}

// ── Module-level singletons ────────────────────────────────────────────────
const state = reactive({
  /** 當前玩法（renxuan / liangmian，外加合成的選號彩池玩法 xuanhao） */
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
  runtime: null as Kl8Current | null,
  /** 當期自己的注單（下注成功後本地追加，開獎後由 user-record 覆蓋） */
  detail: [] as Array<{ orderId: string; betCode: string[]; coin: number; odds?: number; time: string }>
})

const select = reactive({
  items: [] as Kl8SelectItem[],
  pool: [] as Kl8SelectItem[],
  show: true,
  resetToken: 0
})

/**
 * 任選（複式）狀態
 *
 * ⚠️ 與 select.pool 是兩套：表格看板是「一注項一金額」，任選是「選一堆號碼 → 展開成多注、共用同一個金額」。
 *    塞進同一個 pool 會讓 Board 與送單流程各自長分支，所以分開放。號碼池為 1~80。
 */
const renxuan = reactive({
  /** 號碼池 01~80 的選取狀態 */
  pool: KL8_NUMBERS.map((num) => ({ num, label: kl8NumberLabel(num), select: false })),
  /** 單注金額（每個組合各下這個金額） */
  amount: 10 as number
})

/**
 * 爆池狀態
 * ⚠️ 快樂8沒有官方盤、也沒有共用彩池 —— 這是它唯一的池，
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
 * ⚠️ 這個玩法刻意不進 kl8cd/plays.js（比照 k3-of 的 xuanhao），playList 由 `playList` 計算屬性
 *    合成注入，選號池另外用這組獨立狀態管理，不與 `select.pool`／`renxuan.pool` 混用。
 *    固定選 KL8_POOL_PICK_COUNT 碼（1~80、不重複），依命中顆數分層派彩。
 */
const poolPlay = reactive({
  nums: KL8_NUMBERS.map((num) => ({ num, label: kl8NumberLabel(num), select: false })),
  /** 單注金額（一注固定 3 碼，只有一注，不像任選會展開成多注） */
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
  betHistory: [] as Kl8UserBetHistory[],
  claimableIssues: [] as LotteryClaimableIssue[]
})

const openCodeHistory = reactive({
  isLoading: false,
  errorMessage: '',
  list: [] as LotteryOpenCodeHistoryItem[]
})

/** 私有資料轉換（不對外，命名依專案規範以底線物件收斂） */
const _handlers = {
  /**
   * 從 set 取 k 個的所有組合（遞迴，遞增序）
   * 與來源 `renxuan/play_script.js` 的 `doCalcCombination()` 同一套邏輯；
   * 最大規模是任二中二選 8 碼 → C(8,2) = 28 注。
   */
  combinations: (set: number[], k: number): number[][] => {
    const size = Math.trunc(Number(k) || 0)
    if (size <= 0 || size > set.length) return []
    if (size === set.length) return [[...set]]
    if (size === 1) return set.map((num) => [num])
    const result: number[][] = []
    for (let i = 0; i <= set.length - size; i++) {
      const head = set[i] as number
      _handlers.combinations(set.slice(i + 1), size - 1).forEach((tail) => result.push([head, ...tail]))
    }
    return result
  },
  /** 任選注碼：分頁名 + 逗號分隔號碼（例 `任三中三03,07,15`） */
  renxuanCodeOf: (nums: number[]): string =>
    `${state.selectTabName}${nums.map((num) => kl8NumberLabel(num)).join(',')}`
}

// ── Computed ───────────────────────────────────────────────────────────────
const lotteryMeta = computed(() => LOTTERY.KL8)
/**
 * 玩法清單：附加彩池玩法（選號）的合成分頁項目
 * ⚠️ 這個玩法刻意不進 C_PLAYS（kl8cd/plays.js），比照 k3-of 的 xuanhao —— 沒有對應的看板分頁，
 *    `list` 留空即可，頁面的子分頁列本來就 `v-if="groupList.length > 1"`，會自動不顯示。
 */
const playList = computed(() => [
  ...(C_PLAYS as Array<{ key?: string; name?: string; list?: any[] }>),
  { key: KL8_POOL_PLAY_KEY, name: '選號（彩池）', list: [] }
])
/** 當前玩法的分頁清單 */
const groupList = computed(() => playList.value.find((play) => play.key === state.select)?.list ?? [])
/** 是否為彩池玩法（選號）分頁 */
const isPoolPlay = computed(() => state.select === KL8_POOL_PLAY_KEY)
/** 當前分頁限額（彩池玩法用自己的硬編碼額度，不查 kl8cd 的看板設定） */
const currentQuota = computed(() => isPoolPlay.value ? KL8_POOL_QUOTA : kl8QuotaOf(state.select, state.selectTabId))
/** 已選注項數（表格看板） */
const selectedCount = computed(() => select.items.filter((item) => Number(item.coin) > 0).length)

/** 當前分頁的任選設定；非任選分頁為 null（同時也是「是不是複式看板」的判斷依據） */
const currentChosen = computed(() => kl8ChosenOf(state.select, state.selectTabId))
const isRenxuan = computed(() => currentChosen.value !== null)
/** 任選已選號碼（依號碼遞增，注碼才有唯一寫法） */
const renxuanPicked = computed(() =>
  renxuan.pool.filter((item) => item.select).map((item) => item.num).sort((a, b) => a - b)
)
/** 任選複式展開的組合（C(已選, N)）；未達最少選號數時為空 */
const renxuanCombos = computed(() => {
  const chosen = currentChosen.value
  if (!chosen) return [] as number[][]
  const picked = renxuanPicked.value
  if (picked.length < chosen.min) return [] as number[][]
  return _handlers.combinations(picked, chosen.pick)
})
/** 任選單注賠率（只跟一注幾碼有關，與挑哪些號碼無關） */
const renxuanOdds = computed(() => {
  const first = renxuanCombos.value[0]
  if (!first) return 0
  return kl8TabOddsOf(state.select, state.selectTabId, _handlers.renxuanCodeOf(first))
})
/** 任選本次投注總額 = 單注 × 注數 */
const renxuanTotal = computed(() =>
  Number((Math.max(0, Math.trunc(Number(renxuan.amount) || 0)) * renxuanCombos.value.length).toFixed(2))
)

/** 彩池玩法已選號碼（依號碼遞增） */
const poolPlayPicked = computed(() =>
  poolPlay.nums.filter((item) => item.select).map((item) => item.num).sort((a, b) => a - b)
)
/** 是否已選滿 KL8_POOL_PICK_COUNT 碼（湊滿才能送單，不像任選可以複式展開） */
const poolPlayReady = computed(() => poolPlayPicked.value.length === KL8_POOL_PICK_COUNT)

/** 本次投注總額（依當前看板模式取其一） */
const totalAmount = computed(() => {
  if (isRenxuan.value) return renxuanTotal.value
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

/** 重算「當前注項」：isactive || money > 0（與 useKl10 同一套） */
function _syncSelectItems() {
  select.items = select.pool.filter((item) => Boolean(item.select) || Number(item.coin) > 0)
}

// 切換分頁／玩法時把金額夾回新分頁限額（超限會被伺端整筆拒單）
watch(() => [state.select, state.selectTabId], () => {
  const quota = currentQuota.value
  const clamp = (money: number) =>
    Math.min(quota.item.max, Math.max(quota.item.min, Math.trunc(Number(money) || 0)))
  state.amount = clamp(state.amount)
  // 任選的單注金額是另一個欄位（每個組合各下這個金額），同樣要夾
  renxuan.amount = clamp(renxuan.amount)
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
    // 選號（彩池）是合成分頁、不在 C_PLAYS 裡，沒有 firstTab 可對——清掉分頁欄位，
    // 不然會沿用上一個玩法的 tabId/tabName（顯示與限額查詢都會對錯分頁）。
    state.selectTabId = firstTab ? Number(firstTab.tabId) : 0
    state.selectTabName = firstTab ? String(firstTab.tabName) : ''
    select.items = []
    select.pool = []
    _actions.clearRenxuan()
    _actions.clearPool()
    // 看板的 layout 是 computed，清掉 pool 後要 bump 讓它重新登記
    select.resetToken += 1
  },
  setTab: (tabId: number | string) => {
    const tab = findKl8Tab(state.select, tabId)
    if (!tab) return
    state.selectTabId = Number(tab.tabId)
    state.selectTabName = String(tab.tabName)
    select.items = []
    select.pool = []
    // 任選換分頁等於換「一注幾碼」，已選號碼一律清掉，避免沿用上一個分頁的張數
    _actions.clearRenxuan()
    select.resetToken += 1
  },
  /** 看板初始化時登記當前分頁所有注項（同一批 reactive 物件，改 select / coin 會反映到畫面） */
  registerSelectPool: (items: Kl8SelectItem[]) => {
    select.pool = Array.isArray(items) ? items : []
  },
  syncSelectItems: () => { _syncSelectItems() },
  /** 點注項：切換選取，選取時套用投注金額（同 useKl10 的 toggleItem） */
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
      const tmp = shuffled[i] as Kl8SelectItem
      shuffled[i] = shuffled[j] as Kl8SelectItem
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
  /**
   * 任選：點號碼切換選取
   * 超過該分頁 maxChosen 時不再加選（與來源 `renxuan/play_script.js` 的 switchBetSelect 相同），
   * 回傳訊息讓呼叫端決定要不要提示。
   */
  toggleRenxuanNumber: (num: number) => {
    const chosen = currentChosen.value
    if (!chosen) return { ok: false, message: '此分頁不是任選玩法' }
    const item = renxuan.pool.find((option) => option.num === Number(num))
    if (!item) return { ok: false, message: '號碼不存在' }
    if (!item.select && renxuanPicked.value.length >= chosen.max) {
      return { ok: false, message: `最多只能選 ${chosen.max} 個號碼` }
    }
    item.select = !item.select
    return { ok: true, message: '' }
  },
  /** 任選：設定單注金額（每個組合各下這個金額） */
  setRenxuanAmount: (money: number) => {
    renxuan.amount = Math.max(0, Math.trunc(Number(money) || 0))
  },
  /** 任選：隨機選滿該分頁的最少選號數 */
  randomRenxuan: () => {
    const chosen = currentChosen.value
    if (!chosen) return 0
    const shuffled = [...renxuan.pool]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = shuffled[i] as (typeof renxuan.pool)[number]
      shuffled[i] = shuffled[j] as (typeof renxuan.pool)[number]
      shuffled[j] = tmp
    }
    const picked = new Set(shuffled.slice(0, chosen.min).map((item) => item.num))
    renxuan.pool.forEach((item) => { item.select = picked.has(item.num) })
    return picked.size
  },
  clearRenxuan: () => {
    renxuan.pool.forEach((item) => { item.select = false })
  },
  /**
   * 彩池玩法：點號碼切換選取
   * 固定選 KL8_POOL_PICK_COUNT 碼（不像任選可以複式展開），選滿後不再加選，需先取消一個。
   */
  togglePoolNumber: (num: number) => {
    const item = poolPlay.nums.find((option) => option.num === Number(num))
    if (!item) return { ok: false, message: '號碼不存在' }
    if (!item.select && poolPlayPicked.value.length >= KL8_POOL_PICK_COUNT) {
      return { ok: false, message: `固定選 ${KL8_POOL_PICK_COUNT} 個號碼，請先取消已選號碼` }
    }
    item.select = !item.select
    return { ok: true, message: '' }
  },
  /** 彩池玩法：設定單注金額 */
  setPoolAmount: (money: number) => {
    poolPlay.amount = Math.max(0, Math.trunc(Number(money) || 0))
  },
  /** 彩池玩法：隨機選滿 KL8_POOL_PICK_COUNT 碼 */
  randomPool: () => {
    const shuffled = [...poolPlay.nums]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = shuffled[i] as (typeof poolPlay.nums)[number]
      shuffled[i] = shuffled[j] as (typeof poolPlay.nums)[number]
      shuffled[j] = tmp
    }
    const picked = new Set(shuffled.slice(0, KL8_POOL_PICK_COUNT).map((item) => item.num))
    poolPlay.nums.forEach((item) => { item.select = picked.has(item.num) })
    return picked.size
  },
  clearPool: () => {
    poolPlay.nums.forEach((item) => { item.select = false })
  },
  /** 該注項照某組開獎會不會中（畫面標示用，與結算共用同一支判定） */
  judgeItem: (betCode: string, openCode: string[], odds = 0) =>
    judgeKl8Bet(betCode, openCode, 1, odds),
  sumOf: (openCode: string[]) => {
    const nums = kl8NumbersOf((Array.isArray(openCode) ? openCode : []).map(Number))
    return nums ? kl8SumOf(nums) : 0
  },
  /** 該期開獎的兩面特徵（看板／路珠顯示用，與結算共用同一組判定函式） */
  zoneOf: (openCode: string[]) => {
    const nums = kl8NumbersOf((Array.isArray(openCode) ? openCode : []).map(Number))
    if (!nums) return { sum: 0, zone: '', parityZone: '', wuxing: '' }
    const sum = kl8SumOf(nums)
    return { sum, zone: kl8ZoneOf(nums), parityZone: kl8ParityZoneOf(nums), wuxing: kl8WuxingOf(sum) }
  }
}

// ── Fetch ──────────────────────────────────────────────────────────────────
const fetch = {
  /** 爆池狀態（看板附加資訊，取不到就維持舊值，不蓋掉主要流程的錯誤訊息） */
  creditJackpot: async () => {
    try {
      Object.assign(creditJackpot, await api.lottery.jackpotKl8())
    } catch {
      // 靜默：爆池只是顯示用
    }
  },
  /** 彩池玩法（選號）狀態——與上面的爆池是兩個獨立的池 */
  poolState: async () => {
    try {
      Object.assign(poolPlayState, await api.lottery.poolKl8())
    } catch {
      // 靜默：彩池玩法狀態只是顯示用
    }
  },
  refreshCurrentInfo: async () => {
    try {
      const result = await api.lottery.currentKl8()
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
      const res = await api.lottery.userRecordKl8()
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
      const res = await api.lottery.openCodeHistoryKl8()
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
      const res = await api.lottery.claimOneIssueKl8()
      if (res?.ok) {
        wallet.coin = Number(res.coin ?? wallet.coin)
        await fetch.userRecordAll()
      }
      return res
    } finally {
      userRecord.isSubmittingClaim = false
    }
  },
  /** 投注：以當前選取的注項送單（表格看板：兩面） */
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
   * 投注：任選（複式）
   *
   * 把已選號碼展開成 C(k, N) 個組合，每個組合各成一注、各帶自己的注碼
   * —— 伺端仍然是一注一注驗、一注一注派彩，不必為複式開特例。
   * ⚠️ 賠率不從這裡送（伺端會用 kl8TabOddsOf 依注碼重算後鎖進注單）。
   */
  betsRenxuan: async () => {
    const chosen = currentChosen.value
    if (!chosen) {
      state.message = '此分頁不是任選玩法'
      return { ok: false, message: state.message }
    }
    const coin = Math.max(0, Math.trunc(Number(renxuan.amount) || 0))
    if (!(coin > 0)) {
      state.message = '請填入單注金額'
      return { ok: false, message: state.message }
    }
    const picked = renxuanPicked.value
    if (picked.length < chosen.min) {
      state.message = `至少要選 ${chosen.min} 個號碼`
      return { ok: false, message: state.message }
    }
    const combos = renxuanCombos.value
    if (combos.length === 0) {
      state.message = '沒有可下注的組合'
      return { ok: false, message: state.message }
    }
    const playId = String(
      findKl8Tab(state.select, state.selectTabId)?.tabGroup?.[0]?.groupList?.[0]?.playId ?? ''
    )
    return fetch.submit(
      [{
        playKey: state.select,
        playTypeName: state.selectTabName,
        selectTabId: state.selectTabId,
        playList: combos.map((combo) => ({
          playId,
          selectTabId: state.selectTabId,
          label: _handlers.renxuanCodeOf(combo),
          amount: coin
        }))
      }],
      Number((coin * combos.length).toFixed(2))
    )
  },
  /**
   * 投注：彩池玩法（選號）
   * 固定 3 碼一注，不像任選會展開成多注；賠率概念不適用（依命中顆數分層派彩，見伺端結算）。
   */
  betsPool: async () => {
    if (!poolPlayReady.value) {
      state.message = `請選滿 ${KL8_POOL_PICK_COUNT} 個號碼`
      return { ok: false, message: state.message }
    }
    const coin = Math.max(0, Math.trunc(Number(poolPlay.amount) || 0))
    if (!(coin > 0)) {
      state.message = '請填入單注金額'
      return { ok: false, message: state.message }
    }
    return fetch.submit(
      [{
        playKey: KL8_POOL_PLAY_KEY,
        playTypeName: '選號（彩池）',
        selectTabId: 0,
        playList: [{ codes: poolPlayPicked.value, amount: coin }]
      }],
      coin
    )
  },
  /**
   * 自動投注：從當前分頁的注項池隨機取 count 項，各下 amount 元
   * 直接組 payload 送單，不經由 select.items —— 這樣不會覆蓋使用者手動填的注項。
   *
   * ⚠️ 任選分頁沒有 select.pool（它的看板是號碼池），改為「隨機選滿最少選號數 → 送複式」：
   *    count 在那裡指「要下幾組隨機組合」沒有意義（組合數由選幾個號碼決定），故忽略 count。
   * ⚠️ 彩池玩法同樣沒有 select.pool，固定選 KL8_POOL_PICK_COUNT 碼、固定一注，count 也忽略。
   */
  autoBets: async ({ count, amount }: { count: number; amount: number }) => {
    if (isRenxuan.value) {
      const coin = Math.max(0, Math.trunc(Number(amount) || 0))
      if (!(coin > 0)) return { ok: false, message: '請填入投注金額', count: 0, amount: 0 }
      renxuan.amount = coin
      if (_actions.randomRenxuan() === 0) return { ok: false, message: '任選設定尚未載入', count: 0, amount: 0 }
      const combos = renxuanCombos.value.length
      const result = await fetch.betsRenxuan()
      return { ...result, count: combos, amount: coin * combos }
    }
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
      const tmp = shuffled[i] as Kl8SelectItem
      shuffled[i] = shuffled[j] as Kl8SelectItem
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
      _actions.clearRenxuan()
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

export function useKl8() {
  return {
    state,
    current,
    creditJackpot,
    poolPlay,
    poolPlayState,
    select,
    renxuan,
    wallet,
    time,
    userRecord,
    openCodeHistory,

    lotteryMeta,
    playList,
    groupList,
    currentQuota,
    currentChosen,
    isRenxuan,
    renxuanPicked,
    renxuanCombos,
    renxuanOdds,
    renxuanTotal,
    isPoolPlay,
    poolPlayPicked,
    poolPlayReady,
    selectedCount,
    totalAmount,
    isOpen,
    canSubmit,

    actions: _actions,
    fetch,
    /** 玩法定義（供玩法列表對帳） */
    playDefinitions: KL8_PLAY_DEFINITIONS,
    /** 注項賠率查詢（依分頁 rtp 即時推算） */
    oddsOf: kl8TabOddsOf,
    /** 彩池玩法固定選號數（供 Picker 顯示「已選 x/N」） */
    poolPickCount: KL8_POOL_PICK_COUNT
  }
}
