/**
 * 11選5 官方盤看板設定的讀取層
 *
 * 結構與 shared/config/sscof/helpers.ts 一致：賠率與限額都以「分頁（tabId）設定」為主，
 * 取不到才退回全域預設；前端顯示 / clamp、伺端驗證 / 派彩全部走這裡。
 *
 * ── 三類分頁 ────────────────────────────────────────────
 *   單選分頁（combo = null）—— groupList 就是注項清單（定位膽／不定位／趣味玩法）
 *   展開型分頁（direct / group / any / dantuo）—— groupList 是「該格可選的號碼」，
 *                                              注碼由 x5OfComboCodes() 展開
 *   單式分頁（single）—— groupList 是**空的**，注碼由 x5OfSingleCodes() 依 conf 全部列舉
 *
 * ── 兩套派彩並存 ────────────────────────────────────────
 *   後三直選（combo.pool = true，複式與單式兩個分頁）→ 吃共用彩池，依命中位數分層（見 x5-of.ts）
 *   其餘 52 個分頁                                  → 固定賠率，x5OfTabOddsOf() 推算後鎖進注單
 *   ⚠️ 彩池分頁的 x5OfTabOddsOf() 一律回 0，但 x5OfHasBetCode() 照常驗 ——
 *      注碼形狀與其他分頁一樣是字串，只有派彩方式不同。
 *
 * ⚠️ 本檔 import x5-of.ts，因此 x5-of.ts 不可反向 import 本檔（會形成循環）。
 */
import C_PLAYS from '#shared/config/x5of/plays'
import {
  x5OfDantuoCombos,
  x5OfDirectCombos,
  x5OfOddsOf,
  x5OfPickCombos,
  x5OfCodeOf,
  X5OF_RTP_FALLBACK,
  X5_OF_MAX_COMBO,
  type X5OfSection
} from '#shared/config/x5-of'
import { X5_NUMBERS, X5_NUMBER_MAX, X5_NUMBER_MIN } from '#shared/config/x5'

export type X5OfQuota = {
  /** 單注投注額 */
  item: { min: number; max: number }
  /** 單期投注額（同一玩家、同一期、同一分頁累計；max = 0 視為不限） */
  issue: { max: number }
}

/** 分頁未設定 quota 時的預設值 */
export const X5OF_QUOTA_FALLBACK: X5OfQuota = {
  item: { min: 2, max: 10000 },
  issue: { max: 0 }
}

/**
 * 選號規則
 *   mode      —— direct（位置直選）／group（組選）／any（任選）／dantuo（膽拖）／single（單式列舉）
 *   kind      —— single 專用：要列舉哪一種注碼（direct / group / any）
 *   prefix    —— 注碼前綴（前三直選、後二組選、任選三中三…）
 *   section   —— direct / group 對應的區段（決定看幾個球位）
 *   positions —— direct 有幾個位置
 *   size      —— group / any / dantuo 一注幾碼
 *   minPick   —— 每格至少要選幾個，給看板擋送單用
 *   pool      —— true 代表該分頁走彩池分層（後三直選），不吃 rtp 賠率
 */
export type X5OfCombo = {
  mode: 'direct' | 'group' | 'any' | 'dantuo' | 'single'
  kind?: 'direct' | 'group' | 'any'
  prefix: string
  section?: X5OfSection
  positions?: number
  size?: number
  minPick: number
  pool?: boolean
}

type ConfigOption = {
  playId?: string | number
  name?: string | number
  odds?: number
  weight?: number
  /** 該注項／該格可選的號碼；判定不讀這裡，一律看 name（展開型分頁由 combo 展開） */
  digit?: number
}
type ConfigGroup = {
  groupName?: string
  groupList?: ConfigOption[]
  weight?: number
  /** 版面：本群組一列排幾個注項 */
  columns?: number
  /** 展開型分頁：本群組對應第幾格（0 起算；dantuo 的 0 = 膽碼、1 = 拖碼） */
  pos?: number
  /** 該格至少要選幾個 */
  minPick?: number
}
type ConfigTab = {
  tabId?: number
  tabName?: string
  settings?: {
    quota?: Partial<X5OfQuota>
    /** rtp：賠率由該注碼的樣本空間推公平值後 × rtp，config 的 odds 只是快照 */
    payout?: { rtp?: number; maxOdds?: number }
  }
  combo?: X5OfCombo
  tabGroup?: ConfigGroup[]
}
type ConfigPlay = { key?: string; name?: string; list?: ConfigTab[] }

const _plays = C_PLAYS as ConfigPlay[]

const _num = (value: unknown, fallback: number): number => {
  const num = Number(value)
  return Number.isFinite(num) && num >= 0 ? num : fallback
}

/** 玩法清單（給前端的玩法列用） */
export function x5OfPlays(): ConfigPlay[] {
  return _plays
}

/** 取玩法設定（sanma / erma / budingwei / dingwei / renxuanfu / renxuandan / renxuandt / quwei） */
export function findX5OfPlay(playKey?: string): ConfigPlay | null {
  const key = String(playKey ?? '')
  if (!key) return null
  return _plays.find((play) => play.key === key) ?? null
}

/** 取分頁設定；tabId 給不出來時回該玩法第一個分頁 */
export function findX5OfTab(playKey?: string, tabId?: number | string): ConfigTab | null {
  const play = findX5OfPlay(playKey)
  if (!play?.list?.length) return null
  const id = Number(tabId)
  if (!Number.isFinite(id) || id <= 0) return play.list[0] ?? null
  return play.list.find((tab) => Number(tab.tabId) === id) ?? null
}

/** 該分頁的選號規則；單選分頁（定位膽／不定位／趣味玩法）回 null */
export function x5OfComboOf(playKey?: string, tabId?: number | string): X5OfCombo | null {
  return findX5OfTab(playKey, tabId)?.combo ?? null
}

/** 該分頁是否走彩池分層（後三直選的複式與單式） */
export function x5OfIsPoolTab(playKey?: string, tabId?: number | string): boolean {
  return x5OfComboOf(playKey, tabId)?.pool === true
}

/** 該分頁是不是「單式」（注碼由 conf 列舉出來讓玩家直接選） */
export function x5OfIsSingleTab(playKey?: string, tabId?: number | string): boolean {
  return x5OfComboOf(playKey, tabId)?.mode === 'single'
}

/** 取分頁的投注限額 */
export function x5OfQuotaOf(playKey?: string, tabId?: number | string): X5OfQuota {
  const quota = findX5OfTab(playKey, tabId)?.settings?.quota
  return {
    item: {
      min: _num(quota?.item?.min, X5OF_QUOTA_FALLBACK.item.min),
      max: _num(quota?.item?.max, X5OF_QUOTA_FALLBACK.item.max)
    },
    issue: { max: _num(quota?.issue?.max, X5OF_QUOTA_FALLBACK.issue.max) }
  }
}

/** 取分頁設定的回報率 */
export function x5OfRtpOf(playKey?: string, tabId?: number | string): number {
  const rtp = Number(findX5OfTab(playKey, tabId)?.settings?.payout?.rtp)
  return Number.isFinite(rtp) && rtp > 0 ? rtp : X5OF_RTP_FALLBACK
}

/** 取分頁設定的賠率上限（未設定回 0 表示不封頂） */
export function x5OfMaxOddsOf(playKey?: string, tabId?: number | string): number {
  const maxOdds = Number(findX5OfTab(playKey, tabId)?.settings?.payout?.maxOdds)
  return Number.isFinite(maxOdds) && maxOdds > 0 ? maxOdds : 0
}

/**
 * 取注碼賠率（含本金）
 *
 * 一律由 x5-of.ts 依「公平賠率 × 該分頁 rtp」推算，而不是讀 config 的 odds ——
 * config 的 odds 只是產生時的快照，改 rtp 就會與實際不符。
 * @returns 賠率；注碼無法辨識或不屬於該分頁回 0（彩池分頁一律回 0，那邊不吃賠率）
 */
export function x5OfTabOddsOf(playKey?: string, tabId?: number | string, betCode?: string | number): number {
  const code = String(betCode ?? '').trim()
  if (!code || !x5OfHasBetCode(playKey, tabId, code)) return 0
  if (x5OfIsPoolTab(playKey, tabId)) return 0
  const odds = x5OfOddsOf(code, x5OfRtpOf(playKey, tabId))
  if (!(odds > 0)) return 0
  const maxOdds = x5OfMaxOddsOf(playKey, tabId)
  return maxOdds > 0 ? Math.min(odds, maxOdds) : odds
}

/**
 * 該注碼是否屬於指定分頁（伺端驗證用）
 *
 * 單選分頁：注碼要在 groupList 內。
 * 展開型／單式分頁：注碼由前端展開或列舉，清單裡沒有 —— 改驗
 *   「前綴符合該分頁的 combo 規則」+「該注碼能被 x5-of.ts 判定」（賠率 > 0 即代表格式合法）。
 * ⚠️ 彩池分頁的 x5OfOddsOf 仍然算得出賠率（只有 x5OfTabOddsOf 才刻意回 0），
 *    所以這裡用 x5OfOddsOf 而不是 x5OfTabOddsOf —— 用後者會把彩池分頁的注碼全部判成無效。
 */
export function x5OfHasBetCode(playKey?: string, tabId?: number | string, betCode?: string | number): boolean {
  const code = String(betCode ?? '').trim()
  if (!code) return false
  const tab = findX5OfTab(playKey, tabId)
  if (!tab) return false

  const combo = tab.combo
  if (combo) {
    if (!code.startsWith(combo.prefix)) return false
    return x5OfOddsOf(code, x5OfRtpOf(playKey, tabId)) > 0
  }

  const groups = Array.isArray(tab.tabGroup) ? tab.tabGroup : []
  return groups.some((group) => (Array.isArray(group.groupList) ? group.groupList : []).some((option) => {
    if (String(option?.playId ?? '') === code) return true
    return String(option?.name ?? '') === code
  }))
}

/**
 * 取注項的爆池權重（官方盤與信用盤共吃一池）
 * 順序：注項 weight → 群組 weight → 0（不參與分配）
 * 明確給 0 代表「排除」，與「沒設定」不同，故用 null 判斷而非 falsy
 * ⚠️ 展開型／單式分頁的注碼不在清單裡，退回該分頁第一個群組的 weight（同 sscog 的做法）
 */
export function x5OfJackpotWeightOf(playKey?: string, tabId?: number | string, betCode?: string | number): number {
  const code = String(betCode ?? '').trim()
  const tab = findX5OfTab(playKey, tabId)
  if (!tab) return 0
  const groups = Array.isArray(tab.tabGroup) ? tab.tabGroup : []
  for (const group of groups) {
    const list = Array.isArray(group.groupList) ? group.groupList : []
    const item = list.find((option) => String(option?.name ?? '') === code || String(option?.playId ?? '') === code)
    if (!item) continue
    const itemWeight = item.weight == null ? null : Number(item.weight)
    if (itemWeight != null && Number.isFinite(itemWeight) && itemWeight >= 0) return itemWeight
    const groupWeight = group.weight == null ? null : Number(group.weight)
    if (groupWeight != null && Number.isFinite(groupWeight) && groupWeight >= 0) return groupWeight
    return 0
  }
  const first = groups[0]
  return first?.weight == null ? 0 : Number(first.weight)
}

/**
 * 展開選號 → 注碼清單（前端送單前呼叫；伺端也用它對帳注數）
 *
 * @param picks 依格排列的選號集合：
 *   direct —— picks[0] = 第一格選的號碼…（長度要等於 combo.positions）
 *   group  —— 只看 picks[0]，取 size 個
 *   any    —— 同 group
 *   dantuo —— picks[0] = 膽碼、picks[1] = 拖碼
 * @returns 一注一碼的清單；規則不合或超過 X5_OF_MAX_COMBO 上限回空陣列
 */
export function x5OfComboCodes(
  playKey?: string,
  tabId?: number | string,
  picks?: Array<Array<number | string>>
): string[] {
  const combo = x5OfComboOf(playKey, tabId)
  if (!combo) return []
  const sets = Array.isArray(picks) ? picks : []
  const size = Number(combo.size ?? 0)

  let rows: number[][] = []
  if (combo.mode === 'direct') {
    const positions = Number(combo.positions ?? 0)
    const used = sets.slice(0, positions)
    if (positions <= 0 || used.length !== positions) return []
    rows = x5OfDirectCombos(used)
  } else if (combo.mode === 'group' || combo.mode === 'any') {
    rows = x5OfPickCombos(sets[0] ?? [], size)
  } else if (combo.mode === 'dantuo') {
    rows = x5OfDantuoCombos(sets[0] ?? [], sets[1] ?? [], size)
  } else {
    // single：注碼是玩家從 x5OfSingleCodes() 的清單直接挑的，不經過展開
    return []
  }

  if (rows.length === 0 || rows.length > X5_OF_MAX_COMBO) return []
  return rows.map((nums) => `${combo.prefix}${x5OfCodeOf(nums)}`)
}

/**
 * 單式分頁的全部注碼（依 conf 列舉，給看板列出來讓玩家選）
 *
 * ⚠️ 這些注碼**不寫進設定檔** —— 三碼直選單式有 990 個、任選五中五單式有 462 個，
 *    寫進 plays.js 只會讓檔案膨脹到不可讀，且與 x5-of.ts 的規則可能不同步。
 *    改成由這裡依 combo 的 kind/section/size 即時列舉，規則只有一份。
 * @returns 一注一碼的清單（遞增排序／位置順序）；非單式分頁回空陣列
 */
export function x5OfSingleCodes(playKey?: string, tabId?: number | string): string[] {
  const combo = x5OfComboOf(playKey, tabId)
  if (!combo || combo.mode !== 'single') return []
  const size = Number(combo.size ?? 0)

  if (combo.kind === 'direct') {
    const positions = Number(combo.positions ?? 0)
    if (positions <= 0) return []
    // 每個位置都可選全部號碼，展開時會濾掉重複號碼（990 / 110 注）
    const pools = Array.from({ length: positions }, () => [...X5_NUMBERS])
    return x5OfDirectCombos(pools).map((nums) => `${combo.prefix}${x5OfCodeOf(nums)}`)
  }
  // group / any：全部遞增組合（C(11, size)）
  return x5OfPickCombos([...X5_NUMBERS], size).map((nums) => `${combo.prefix}${x5OfCodeOf(nums)}`)
}

/**
 * 每格可選的號碼（給看板畫選號格）
 * @returns 依 pos 排好的群組；單選分頁與單式分頁回空陣列（那兩種不是「選號格」）
 */
export function x5OfComboGroups(
  playKey?: string,
  tabId?: number | string
): Array<{ pos: number; label: string; columns: number; minPick: number; digits: number[] }> {
  const tab = findX5OfTab(playKey, tabId)
  if (!tab?.combo || tab.combo.mode === 'single') return []
  return (Array.isArray(tab.tabGroup) ? tab.tabGroup : [])
    .map((group, idx) => {
      const list = Array.isArray(group.groupList) ? group.groupList : []
      return {
        pos: Number(group.pos ?? idx),
        label: String(group.groupName ?? ''),
        columns: Number(group.columns ?? 6),
        minPick: Number(group.minPick ?? tab.combo?.minPick ?? 1),
        digits: list
          .map((option) => Number(option?.digit))
          .filter((digit) => Number.isInteger(digit) && digit >= X5_NUMBER_MIN && digit <= X5_NUMBER_MAX)
      }
    })
    .sort((a, b) => a.pos - b.pos)
}

/**
 * 單選分頁的注項清單（定位膽／不定位／趣味玩法）
 * @returns 群組化的注項；展開型與單式分頁回空陣列
 */
export function x5OfItemGroups(
  playKey?: string,
  tabId?: number | string
): Array<{ groupName: string; columns: number; items: Array<{ name: string; digit?: number }> }> {
  const tab = findX5OfTab(playKey, tabId)
  if (!tab || tab.combo) return []
  return (Array.isArray(tab.tabGroup) ? tab.tabGroup : []).map((group) => ({
    groupName: String(group.groupName ?? ''),
    columns: Number(group.columns ?? 6),
    items: (Array.isArray(group.groupList) ? group.groupList : []).map((option) => ({
      name: String(option?.name ?? ''),
      digit: option?.digit == null ? undefined : Number(option.digit)
    }))
  }))
}
