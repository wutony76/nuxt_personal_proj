import { computed, reactive, watch } from 'vue'
import { LOTTERY, STATUS_TIME, STATUS_ERR_CODE } from '~/config/constants'
import {
  api,
  type Fc3dCurrent,
  type Fc3dUserBetHistory,
  type LotteryUserBalanceChange,
  type LotteryClaimableIssue,
  type LotteryOpenCodeHistoryItem
} from '~/services/api'
import { FC3D_PLAY_DEFINITIONS, FC3D_MAX_COMBO } from '#shared/config/fc3d-of'
import {
  fc3dPlays,
  findFc3dTab,
  fc3dComboOf,
  fc3dComboGroups,
  fc3dComboCodes,
  fc3dQuotaOf,
  fc3dTabOddsOf,
  type Fc3dOfCombo
} from '#shared/config/fc3dof/helpers'

/**
 * 福彩3D（FC3D）前端狀態
 *
 * ── 與 useEggs / useSsc 的差異 ──────────────────────────
 *   來源（bglottery fc3d）只有官方盤、沒有信用盤，也沒有任何彩池／爆池，
 *   所以沒有 mode / setMode、沒有信用盤選號、也沒有 creditJackpot / poolPlay。
 *   看板有兩種型態（比照 useSsc 的 of.items / of.picks）：
 *     單選分頁（定位膽）           → board.items（code/odds/coin）
 *     複式分頁（其餘 4 個分頁）    → board.picks（依 combo.mode 展開，見 fc3dComboCodes）
 *   另外多一種來源沒有的輸入型態（三星直選單式）→ board.input（文字框直接貼注碼）。
 *
 * ⚠️ state 是 module 級單例（與 useEggs / useSsc 相同做法）。
 */

/** 看板單選注項（定位膽用） */
export type Fc3dSelectItem = { code: string; odds: number; coin: number }

const PLAYS = fc3dPlays() as Array<{ key?: string; name?: string; list?: Array<{ tabId?: number; tabName?: string }> }>

// ── Module-level singletons ────────────────────────────────────────────────
const state = reactive({
  /** 當前玩法（dingwei / zhixuan / sanxing / budingwei / daxiao） */
  play: String(PLAYS[0]?.key ?? ''),
  tabId: Number(PLAYS[0]?.list?.[0]?.tabId ?? 0),
  tabName: String(PLAYS[0]?.list?.[0]?.tabName ?? ''),
  /** 投注金額：點注項或展開複式時套用這個值 */
  amount: 10 as number,
  fetchStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',
  submitStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',
  message: '' as string,
  errorMessage: '' as string,
  lastOrderId: '' as string
})

const current = reactive({
  runtime: null as Fc3dCurrent | null,
  /** 當期自己的注單（下注成功後本地追加，開獎後由 user-record 覆蓋） */
  detail: [] as Array<{ orderId: string; betCode: string[]; coin: number; odds?: number; time: string }>
})

/**
 * 看板狀態（三種形狀，依當前分頁的 combo.mode 只會用到其中一種）
 *   items —— 單選分頁（定位膽）：code 即注碼（百位3…）
 *   picks —— 複式分頁：依位置排列的選號集合
 *     direct/sides（前二/後二/三星直選、大小單雙）→ picks[0] = 第一個位置選的號碼／面…
 *     group（前二/後二組選、三星組三/組六、二碼不定位）→ 只用 picks[0]，一組號碼取合法組合
 *     each（三星直選和值、三星組選和值、一碼不定位）→ 只用 picks[0]，每個選號各自成一注
 *   input —— 三星直選單式：文字框直接貼注碼，不走複式展開
 */
const board = reactive({
  items: [] as Fc3dSelectItem[],
  picks: [] as Array<Array<number | string>>,
  input: {
    text: '',
    validCodes: [] as string[],
    invalidCodes: [] as string[]
  }
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
  betHistory: [] as Fc3dUserBetHistory[],
  claimableIssues: [] as LotteryClaimableIssue[]
})

const openCodeHistory = reactive({
  isLoading: false,
  errorMessage: '',
  list: [] as LotteryOpenCodeHistoryItem[]
})

// ── Computed ───────────────────────────────────────────────────────────────
const lotteryMeta = computed(() => LOTTERY.FC3D)
/** 玩法清單（5 個分頁：定位膽/直選組選/三星/不定位/大小單雙） */
const playList = computed(() => PLAYS)
/** 當前玩法的分頁清單 */
const groupList = computed(() => playList.value.find((play) => play.key === state.play)?.list ?? [])
/** 當前分頁的複式規則；單選分頁（定位膽）回 null */
const combo = computed<Fc3dOfCombo | null>(() => fc3dComboOf(state.play, state.tabId))
/** 是否為輸入模式（三星直選單式） */
const isInputMode = computed(() => combo.value?.mode === 'input')
/** 複式分頁每個位置可選的號碼／和值／面 */
const comboGroups = computed(() => fc3dComboGroups(state.play, state.tabId))
/** 當前分頁限額 */
const currentQuota = computed(() => fc3dQuotaOf(state.play, state.tabId))
/** 複式展開後的每一注（注碼字串） */
const comboCodes = computed(() => {
  if (!combo.value || isInputMode.value) return [] as string[]
  return fc3dComboCodes(state.play, state.tabId, board.picks)
})

/** C(n, k) —— 組選類分頁的注數是組合數 */
function _combinations(n: number, k: number): number {
  if (n < k) return 0
  let out = 1
  for (let i = 0; i < k; i++) out = (out * (n - i)) / (i + 1)
  return Math.round(out)
}

/**
 * 展開前的原始注數（不管有沒有超過上限都算得出來）
 *
 * fc3dComboCodes() 超過 FC3D_MAX_COMBO 會回空陣列，畫面沒辦法從空陣列分辨
 * 「還沒選滿」與「選太多」——所以自己算一份原始注數給提示用。
 * ⚠️ 三星組三是 n*(n-1)（有序取「哪個加倍/哪個不加倍」，非單純組合數 C(n,2)，比照 fc3d-of.ts）。
 */
const rawComboCount = computed(() => {
  const c = combo.value
  if (!c || isInputMode.value) return 0
  const sets = board.picks.map((list) => new Set((Array.isArray(list) ? list : []).map(String)).size)
  if (c.mode === 'group') {
    const n = sets[0] ?? 0
    if (c.group === 'group3') return n > 1 ? n * (n - 1) : 0
    if (c.group === 'group6') return _combinations(n, 3)
    return _combinations(n, 2)
  }
  if (c.mode === 'each') {
    return new Set(board.picks.flat().map(String)).size
  }
  const positions = Number(c.positions ?? 0)
  if (sets.length !== positions || sets.some((n) => n === 0)) return 0
  return sets.reduce((acc, n) => acc * n, 1)
})
/** 是否因為超過上限而展不出注碼 */
const comboOverflow = computed(() => rawComboCount.value > FC3D_MAX_COMBO)
/**
 * 複式／輸入模式還不能送單時的提示文案
 * @returns 可以送單時回空字串
 */
const comboHint = computed(() => {
  if (isInputMode.value) {
    if (board.input.invalidCodes.length > 0) return `已略過 ${board.input.invalidCodes.length} 個不合法或重複的注碼`
    if (board.input.validCodes.length > 0) return ''
    return '請輸入 3 位數字注碼（可用逗號或換行分隔多筆）'
  }
  const c = combo.value
  if (!c) return ''
  if (comboOverflow.value) return `展開後超過 ${FC3D_MAX_COMBO} 注，請縮小選號範圍`
  if (comboCodes.value.length > 0) return ''
  return c.mode === 'group' || c.mode === 'each'
    ? `請至少選 ${c.minPick} 個號碼`
    : `請為每一個位置都至少選一個號碼（共 ${c.positions} 個位置）`
})
/** 已選注數：單選＝有金額的注項數、複式＝展開後的注數、輸入＝合法注碼數 */
const selectedCount = computed(() => {
  if (isInputMode.value) return board.input.validCodes.length
  return combo.value ? comboCodes.value.length : board.items.filter((item) => Number(item.coin) > 0).length
})
/** 總投注額：複式／輸入模式每一注都用同一個金額（state.amount） */
const totalAmount = computed(() => {
  if (isInputMode.value) return Number((board.input.validCodes.length * Number(state.amount || 0)).toFixed(2))
  if (combo.value) return Number((comboCodes.value.length * Number(state.amount || 0)).toFixed(2))
  return Number(board.items.reduce((sum, item) => sum + Number(item.coin ?? 0), 0).toFixed(2))
})
const isOpen = computed(() => String(current.runtime?.currentStatus ?? '') === STATUS_TIME.OPEN)
const canSubmit = computed(() =>
  isOpen.value && state.submitStatus !== 'loading' && selectedCount.value > 0 && totalAmount.value > 0
)
/**
 * 自動下注的注數上限（供 footer/Auto.vue 夾住輸入框）
 *   單選分頁 —— 該分頁的注碼數
 *   複式分頁 —— 全選展開的注數，夾到 FC3D_MAX_COMBO
 *   輸入模式 —— 3 位數字全部組合數（1000），夾到 FC3D_MAX_COMBO
 */
const autoMaxCount = computed(() => {
  const c = combo.value
  if (!c) {
    return (findFc3dTab(state.play, state.tabId)?.tabGroup ?? [])
      .flatMap((group: any) => group.groupList ?? []).length
  }
  if (c.mode === 'input') return Math.min(1000, FC3D_MAX_COMBO)
  const groups = comboGroups.value
  if (groups.length === 0) return 0
  const total = c.mode === 'group'
    ? (c.group === 'group3'
      ? groups[0]!.values.length * (groups[0]!.values.length - 1)
      : _combinations(groups[0]!.values.length, c.group === 'group6' ? 3 : 2))
    : groups.reduce((acc, group) => acc * Math.max(group.values.length, group.sides.length), 1)
  return Math.max(0, Math.min(total, FC3D_MAX_COMBO))
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

/** 該分頁的複式有幾組選號格（group / each 模式只有一組） */
function _pickSlots(): number {
  const c = combo.value
  if (!c || c.mode === 'input') return 0
  return c.mode === 'group' || c.mode === 'each' ? 1 : Number(c.positions ?? 0)
}

/** 把複式的 picks 重設成「每個位置一個空陣列」 */
function _resetPicks() {
  board.picks = Array.from({ length: _pickSlots() }, () => [] as Array<number | string>)
}

/** 某個選號格可選的值（號碼／和值／面） */
function _pickOptions(pos: number): Array<number | string> {
  const group = comboGroups.value.find((item) => item.pos === Number(pos))
  if (!group) return []
  return group.sides.length > 0 ? [...group.sides] : [...group.values]
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
 * ⚠️ 加太寬會超過 FC3D_MAX_COMBO（fc3dComboCodes 回空陣列），一旦展不出來就停在上一組
 *    還展得出來的選擇——寧可少於 size，也不要整筆被伺端拒單。
 */
function _widenPicks(pools: Array<Array<number | string>>, size: number): Array<Array<number | string>> | null {
  const c = combo.value
  if (!c) return null
  const start = Math.max(1, Number(c.minPick ?? 1))
  const maxTake = Math.max(...pools.map((list) => list.length), 0)
  let best: Array<Array<number | string>> | null = null
  for (let take = start; take <= maxTake; take++) {
    const picks = pools.map((list) => list.slice(0, take))
    const codes = fc3dComboCodes(state.play, state.tabId, picks)
    if (codes.length === 0) break
    best = picks
    if (codes.length >= size) break
  }
  return best
}

/** 全形數字轉半形（三星直選單式的輸入正規化） */
function _toHalfWidthDigits(text: string): string {
  return text.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
}

/** 解析三星直選單式的輸入框：正規化、切段、驗證 3 位數字、去重複 */
function _parseInputText(raw: string): { validCodes: string[]; invalidCodes: string[] } {
  const normalized = _toHalfWidthDigits(String(raw ?? ''))
  const tokens = normalized.split(/[,，、\s]+/).map((token) => token.trim()).filter((token) => token.length > 0)
  const seen = new Set<string>()
  const validCodes: string[] = []
  const invalidCodes: string[] = []
  tokens.forEach((token) => {
    if (!/^\d{3}$/.test(token) || seen.has(token)) {
      invalidCodes.push(token)
      return
    }
    seen.add(token)
    validCodes.push(token)
  })
  return { validCodes, invalidCodes }
}

// 切換分頁／玩法時把金額夾回新分頁限額（超限會被伺端整筆拒單）
watch(() => [state.play, state.tabId], () => {
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
  /** 切換玩法：分頁指回該玩法第一個，並清空看板 */
  setPlay: (playKey: string) => {
    if (state.play === playKey) return
    const play = PLAYS.find((item) => item.key === playKey)
    const firstTab = play?.list?.[0]
    state.play = playKey
    state.tabId = Number(firstTab?.tabId ?? 0)
    state.tabName = String(firstTab?.tabName ?? '')
    _actions.clearBoard()
  },
  setTab: (tabId: number | string) => {
    const tab = findFc3dTab(state.play, tabId)
    if (!tab) return
    state.tabId = Number(tab.tabId)
    state.tabName = String(tab.tabName ?? '')
    _actions.clearBoard()
  },
  /** 單選分頁（定位膽）：點注項切換選取，選取時套用投注金額 */
  toggleItem: (code: string) => {
    const key = String(code ?? '').trim()
    if (!key) return
    const idx = board.items.findIndex((item) => item.code === key)
    if (idx >= 0) {
      board.items.splice(idx, 1)
      return
    }
    const quota = currentQuota.value.item
    board.items.push({
      code: key,
      odds: fc3dTabOddsOf(state.play, state.tabId, key),
      coin: Math.min(quota.max, Math.max(quota.min, Math.trunc(Number(state.amount) || 0)))
    })
  },
  /** 單選分頁：逐項改金額（0 視為取消該注） */
  setItemCoin: (code: string, coin: number) => {
    const item = board.items.find((row) => row.code === String(code))
    if (!item) return
    const quota = currentQuota.value.item
    item.coin = Math.min(quota.max, Math.max(0, Math.trunc(Number(coin) || 0)))
  },
  /**
   * 複式分頁：切換第 pos 格的某個號碼／和值／面
   * ⚠️ 不需要像 useSsc 那樣依選項順序排序——fc3d-of.ts 的複式展開函式（`_normalizeSets` /
   *    `fc3dGroupCombos`）內部本來就會自己去重＋排序，前端送任意順序都一樣。
   */
  togglePick: (pos: number, value: number | string) => {
    const slots = _pickSlots()
    const idx = Math.trunc(Number(pos))
    if (!(idx >= 0 && idx < slots)) return
    if (board.picks.length !== slots) _resetPicks()
    const options = _pickOptions(idx).map(String)
    const key = String(value)
    if (!options.includes(key)) return
    const list = board.picks[idx] as Array<number | string>
    const at = list.findIndex((item) => String(item) === key)
    if (at >= 0) { list.splice(at, 1); return }
    list.push(value)
  },
  /** 複式分頁：某一格全選 / 全清 */
  togglePickAll: (pos: number) => {
    const slots = _pickSlots()
    const idx = Math.trunc(Number(pos))
    if (!(idx >= 0 && idx < slots)) return
    if (board.picks.length !== slots) _resetPicks()
    const options = _pickOptions(idx)
    const list = board.picks[idx] as Array<number | string>
    board.picks[idx] = list.length === options.length ? [] : [...options]
  },
  /**
   * 隨機選號（count 一律當「目標注數」）
   *   單選分頁 —— 從該分頁所有注項隨機挑 count 個
   *   複式分頁 —— 每格逐步多挑一個，挑到展開後注數 ≥ count 為止
   * @returns 實際選出的注數
   */
  randomSelect: (count: number) => {
    const size = Math.max(1, Math.trunc(Number(count) || 1))
    _actions.clearBoard()
    const c = combo.value
    if (c?.mode === 'input') {
      const codes = new Set<string>()
      while (codes.size < size && codes.size < 1000) {
        codes.add(String(Math.floor(Math.random() * 1000)).padStart(3, '0'))
      }
      _actions.setInputText([...codes].join(','))
      return board.input.validCodes.length
    }
    if (!c) {
      const codes = groupList.value.length
        ? (findFc3dTab(state.play, state.tabId)?.tabGroup ?? [])
          .flatMap((group: any) => (group.groupList ?? []).map((option: any) => String(option?.name ?? '')))
          .filter((code: string) => code.length > 0)
        : []
      _shuffle(codes).slice(0, Math.min(size, codes.length)).forEach((code) => _actions.toggleItem(code))
      return board.items.length
    }
    const pools = Array.from({ length: _pickSlots() }, (_, pos) => _shuffle(_pickOptions(pos)))
    const picks = _widenPicks(pools, size)
    if (!picks) return 0
    board.picks = picks
    return fc3dComboCodes(state.play, state.tabId, board.picks).length
  },
  /** 三星直選單式：更新輸入框內容並重新驗證 */
  setInputText: (text: string) => {
    board.input.text = String(text ?? '')
    const { validCodes, invalidCodes } = _parseInputText(board.input.text)
    board.input.validCodes = validCodes
    board.input.invalidCodes = invalidCodes
  },
  /** 取注碼賠率（依當前分頁 rtp 即時推算，看板顯示用） */
  oddsOf: (code: string) => fc3dTabOddsOf(state.play, state.tabId, String(code ?? '')),
  clearBoard: () => {
    board.items = []
    board.input.text = ''
    board.input.validCodes = []
    board.input.invalidCodes = []
    _resetPicks()
  }
}

// ── Fetch ──────────────────────────────────────────────────────────────────
const fetch = {
  refreshCurrentInfo: async () => {
    try {
      const result = await api.lottery.currentFc3d()
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
      const res = await api.lottery.userRecordFc3d()
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
      const res = await api.lottery.openCodeHistoryFc3d()
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
      const res = await api.lottery.claimOneIssueFc3d()
      if (res?.ok) {
        wallet.coin = Number(res.coin ?? wallet.coin)
        await fetch.userRecordAll()
      }
      return res
    } finally {
      userRecord.isSubmittingClaim = false
    }
  },
  /** 投注：依當前分頁型態組出注項清單送單（定位膽單選／複式展開／單式輸入三選一） */
  betsFc3d: async () => {
    const quota = currentQuota.value.item
    const coin = Math.min(quota.max, Math.max(quota.min, Math.trunc(Number(state.amount) || 0)))
    const playList: Array<{ label: string; amount: number }> = []

    if (isInputMode.value) {
      const c = combo.value
      if (board.input.validCodes.length === 0) {
        state.message = comboHint.value
        return { ok: false, message: state.message }
      }
      board.input.validCodes.forEach((code) => playList.push({ label: `${c?.prefix ?? ''}${code}`, amount: coin }))
    } else if (combo.value) {
      const codes = comboCodes.value
      if (codes.length === 0) {
        state.message = comboHint.value
        return { ok: false, message: state.message }
      }
      codes.forEach((code) => playList.push({ label: code, amount: coin }))
    } else {
      board.items.filter((item) => Number(item.coin) > 0).forEach((item) => {
        playList.push({ label: item.code, amount: Number(item.coin) })
      })
      if (playList.length === 0) {
        state.message = '請先選擇注項並填入金額'
        return { ok: false, message: state.message }
      }
    }

    const total = Number(playList.reduce((sum, row) => sum + Number(row.amount ?? 0), 0).toFixed(2))
    const result = await fetch.submit(
      [{ playKey: state.play, playTypeName: state.tabName, selectTabId: state.tabId, playList }],
      total
    )
    if (result.ok) _actions.clearBoard()
    return result
  },
  /**
   * 自動投注：不動使用者手動選的注項，直接組 payload 送單
   *   單選分頁 —— 從該分頁注碼隨機取 count 個
   *   複式分頁 —— 每格隨機挑，展開到注數 ≥ count（不衝破 FC3D_MAX_COMBO）
   *   輸入模式（三星直選單式）—— 隨機產生 count 個 3 位數字注碼
   */
  autoBets: async ({ count, amount }: { count: number; amount: number }) => {
    const coin = Math.max(0, Math.trunc(Number(amount) || 0))
    if (!(coin > 0)) return { ok: false, message: '請填入投注金額', count: 0, amount: 0 }
    const size = Math.max(1, Math.trunc(Number(count) || 1))
    const c = combo.value
    const playList: Array<{ label: string; amount: number }> = []

    if (c?.mode === 'input') {
      const seen = new Set<string>()
      while (seen.size < size && seen.size < 1000) {
        seen.add(String(Math.floor(Math.random() * 1000)).padStart(3, '0'))
      }
      seen.forEach((code) => playList.push({ label: `${c.prefix}${code}`, amount: coin }))
    } else if (c) {
      const pools = Array.from({ length: _pickSlots() }, (_, pos) => _shuffle(_pickOptions(pos)))
      const picks = _widenPicks(pools, size)
      const codes = picks ? fc3dComboCodes(state.play, state.tabId, picks) : []
      if (codes.length === 0) return { ok: false, message: '此分頁無法自動選號', count: 0, amount: 0 }
      codes.forEach((code) => playList.push({ label: code, amount: coin }))
    } else {
      const codes = (findFc3dTab(state.play, state.tabId)?.tabGroup ?? [])
        .flatMap((group: any) => (group.groupList ?? []).map((option: any) => String(option?.name ?? '')))
        .filter((code: string) => code.length > 0)
      if (codes.length === 0) return { ok: false, message: '注項尚未載入', count: 0, amount: 0 }
      _shuffle(codes).slice(0, Math.min(size, codes.length)).forEach((code) => {
        playList.push({ label: code, amount: coin })
      })
    }

    const total = Number((playList.length * coin).toFixed(2))
    const result = await fetch.submit(
      [{ playKey: state.play, playTypeName: state.tabName, selectTabId: state.tabId, playList }],
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
      // fc3d 沒有彩池／爆池，送單成功只需刷新餘額與注單（不像 eggs/kl10/kl8 還要刷 jackpot/pool）
      await Promise.all([fetch.userInfo(), fetch.userRecordAll()])
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

export function useFc3d() {
  return {
    state,
    current,
    board,
    wallet,
    time,
    userRecord,
    openCodeHistory,

    lotteryMeta,
    playList,
    groupList,
    combo,
    isInputMode,
    comboGroups,
    comboCodes,
    comboOverflow,
    comboHint,
    currentQuota,
    selectedCount,
    totalAmount,
    isOpen,
    canSubmit,
    autoMaxCount,

    actions: _actions,
    fetch,
    /** 玩法定義（供玩法列表對帳） */
    playDefinitions: FC3D_PLAY_DEFINITIONS
  }
}
