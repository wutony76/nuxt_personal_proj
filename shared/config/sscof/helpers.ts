/**
 * 時時彩官方盤看板設定的讀取層
 *
 * 結構與 shared/config/pk10of/helpers.ts 一致：賠率與限額都以「分頁（tabId）設定」為主，
 * 取不到才退回全域預設；前端顯示 / clamp、伺端驗證 / 派彩全部走這裡。
 *
 * ── 兩種分頁型態 ────────────────────────────────────────
 *   單選分頁（定位膽）—— groupList 就是注項清單，注碼＝name（第一球0…）
 *   複式分頁（其餘 10 個）—— groupList 只是「該位置／該組可選的號碼或面」，
 *                          注碼由 sscOfComboCodes() 展開，清單裡找不到，
 *                          所以驗證改走 combo 規則（見 sscOfHasBetCode）
 *
 * ── 複式的三種展開 ──────────────────────────────────────
 *   direct 位置直選（後二／後三／五星）→ 各位置選一組號碼，笛卡爾積
 *   group  組選（後二組選／後三組三／組六）→ 一組號碼取 k 個，不計順序
 *   sides  大小單雙（前二／前三／後二／後三）→ 各位置選一組面，笛卡爾積
 *
 * ── 兩套派彩並存 ────────────────────────────────────────
 *   後三直選（combo.pool = true）→ 吃共用彩池，依命中位數分層（見 ssc-of.ts）
 *   其餘 10 個分頁                → 固定賠率，sscOfTabOddsOf() 推算後鎖進注單
 *   ⚠️ 彩池分頁的 sscOfTabOddsOf() 一律回 0，但 sscOfHasBetCode() 照常驗 ——
 *      時時彩彩池分頁的注碼與其他分頁一樣是字串，只有派彩方式不同。
 *
 * ⚠️ 本檔 import sscof.ts，因此 sscof.ts 不可反向 import 本檔（會形成循環）。
 */
import C_PLAYS from '#shared/config/sscof/plays'
import {
  sscOfOddsOf,
  sscDirectCombos,
  sscGroupCombos,
  sscSideCombos,
  SSCOF_RTP_FALLBACK,
  type SscOfSection
} from '#shared/config/sscof'
import { SSC_DIGIT_MAX } from '#shared/config/ssc'

export type SscOfQuota = {
  /** 單注投注額 */
  item: { min: number; max: number }
  /** 單期投注額（同一玩家、同一期、同一分頁累計；max = 0 視為不限） */
  issue: { max: number }
}

/** 分頁未設定 quota 時的預設值 */
export const SSCOF_QUOTA_FALLBACK: SscOfQuota = {
  item: { min: 2, max: 10000 },
  issue: { max: 0 }
}

/** 組選型態（對應 sscof.ts 的 sscGroupCombos） */
export type SscOfGroupMode = 'group2' | 'group3' | 'group6'

/**
 * 複式選號規則
 *   mode      —— direct（位置直選）／group（組選）／sides（大小單雙）
 *   prefix    —— 注碼前綴（後三直選、後三組三、大小單雙後二…）
 *   section   —— direct / sides 對應的區段（決定看幾個球位）
 *   positions —— direct / sides 有幾個位置
 *   group     —— group 模式的組選型態
 *   minPick   —— 每個位置（group 模式為該組）至少要選幾個，給看板擋送單用
 */
export type SscOfCombo = {
  mode: 'direct' | 'group' | 'sides'
  prefix: string
  section?: SscOfSection
  positions?: number
  group?: SscOfGroupMode
  minPick: number
  /** true 代表該分頁走彩池分層（後三直選），不吃 rtp 賠率 */
  pool?: boolean
}

type ConfigOption = {
  playId?: string | number
  name?: string | number
  odds?: number
  weight?: number
  /** 該注項的號碼；判定不讀這裡，一律看 name（複式分頁則由 combo 展開） */
  digit?: number
  /** 該注項的面（大小單雙分頁用） */
  side?: string
  /** 該注項屬於第幾個球位（0 起算）；只供畫面用 */
  ball?: number
}
type ConfigGroup = {
  groupName?: string
  groupList?: ConfigOption[]
  weight?: number
  /** 版面：本群組一列排幾個注項 */
  columns?: number
  /** 複式分頁：本群組對應第幾個位置（0 起算） */
  pos?: number
}
type ConfigTab = {
  tabId?: number
  tabName?: string
  settings?: {
    quota?: Partial<SscOfQuota>
    /** rtp：賠率由該注碼的樣本空間推公平值後 × rtp，config 的 odds 只是快照 */
    payout?: { rtp?: number; maxOdds?: number }
  }
  combo?: SscOfCombo
  tabGroup?: ConfigGroup[]
}
type ConfigPlay = { key?: string; name?: string; list?: ConfigTab[] }

const _plays = C_PLAYS as ConfigPlay[]

const _num = (value: unknown, fallback: number): number => {
  const num = Number(value)
  return Number.isFinite(num) && num >= 0 ? num : fallback
}

/** 玩法清單（給前端的玩法列用） */
export function sscOfPlays(): ConfigPlay[] {
  return _plays
}

/** 取玩法設定（dingwei / erxing / housan / wuxing / daxiao） */
export function findSscOfPlay(playKey?: string): ConfigPlay | null {
  const key = String(playKey ?? '')
  if (!key) return null
  return _plays.find((play) => play.key === key) ?? null
}

/** 取分頁設定；tabId 給不出來時回該玩法第一個分頁 */
export function findSscOfTab(playKey?: string, tabId?: number | string): ConfigTab | null {
  const play = findSscOfPlay(playKey)
  if (!play?.list?.length) return null
  const id = Number(tabId)
  if (!Number.isFinite(id) || id <= 0) return play.list[0] ?? null
  return play.list.find((tab) => Number(tab.tabId) === id) ?? null
}

/** 該分頁的複式規則；單選分頁（定位膽）回 null */
export function sscOfComboOf(playKey?: string, tabId?: number | string): SscOfCombo | null {
  return findSscOfTab(playKey, tabId)?.combo ?? null
}

/**
 * 該分頁是否走彩池分層（後三直選）
 *
 * ⚠️ 與 pk10 不同的是，彩池分頁的注碼**仍然是字串**（`後三直選123`）——
 *    時時彩號碼可以重複、沒有「同一台車佔兩個名次」的問題，
 *    所以複式展開與注碼驗證都不必為彩池分頁開特例，只有派彩方式不一樣。
 */
export function sscOfIsPoolTab(playKey?: string, tabId?: number | string): boolean {
  return sscOfComboOf(playKey, tabId)?.pool === true
}

/** 取分頁的投注限額 */
export function sscOfQuotaOf(playKey?: string, tabId?: number | string): SscOfQuota {
  const quota = findSscOfTab(playKey, tabId)?.settings?.quota
  return {
    item: {
      min: _num(quota?.item?.min, SSCOF_QUOTA_FALLBACK.item.min),
      max: _num(quota?.item?.max, SSCOF_QUOTA_FALLBACK.item.max)
    },
    issue: { max: _num(quota?.issue?.max, SSCOF_QUOTA_FALLBACK.issue.max) }
  }
}

/** 取分頁設定的回報率 */
export function sscOfRtpOf(playKey?: string, tabId?: number | string): number {
  const rtp = Number(findSscOfTab(playKey, tabId)?.settings?.payout?.rtp)
  return Number.isFinite(rtp) && rtp > 0 ? rtp : SSCOF_RTP_FALLBACK
}

/** 取分頁設定的賠率上限（未設定回 0 表示不封頂） */
export function sscOfMaxOddsOf(playKey?: string, tabId?: number | string): number {
  const maxOdds = Number(findSscOfTab(playKey, tabId)?.settings?.payout?.maxOdds)
  return Number.isFinite(maxOdds) && maxOdds > 0 ? maxOdds : 0
}

/**
 * 取注碼賠率（含本金）
 *
 * 一律由 sscof.ts 依「公平賠率 × 該分頁 rtp」推算，而不是讀 config 的 odds ——
 * config 的 odds 只是產生時的快照，改 rtp 就會與實際不符。
 * @returns 賠率；注碼無法辨識或不屬於該分頁回 0（彩池分頁一律回 0，那邊不吃賠率）
 */
export function sscOfTabOddsOf(playKey?: string, tabId?: number | string, betCode?: string | number): number {
  const code = String(betCode ?? '').trim()
  if (!code || !sscOfHasBetCode(playKey, tabId, code)) return 0
  if (sscOfIsPoolTab(playKey, tabId)) return 0
  const odds = sscOfOddsOf(code, sscOfRtpOf(playKey, tabId))
  if (!(odds > 0)) return 0
  const maxOdds = sscOfMaxOddsOf(playKey, tabId)
  return maxOdds > 0 ? Math.min(odds, maxOdds) : odds
}

/**
 * 該注碼是否屬於指定分頁（伺端驗證用）
 *
 * 單選分頁：注碼要在 groupList 內。
 * 複式分頁：注碼由前端展開，清單裡沒有 —— 改驗「前綴符合該分頁的 combo 規則」，
 *          並且該注碼要能被 sscof.ts 判定（賠率 > 0 即代表格式合法）。
 */
export function sscOfHasBetCode(playKey?: string, tabId?: number | string, betCode?: string | number): boolean {
  const code = String(betCode ?? '').trim()
  if (!code) return false
  const tab = findSscOfTab(playKey, tabId)
  if (!tab) return false

  const combo = tab.combo
  if (combo) {
    if (!code.startsWith(combo.prefix)) return false
    return sscOfOddsOf(code, sscOfRtpOf(playKey, tabId)) > 0
  }

  const groups = Array.isArray(tab.tabGroup) ? tab.tabGroup : []
  return groups.some((group) => (Array.isArray(group.groupList) ? group.groupList : []).some((option) => {
    if (String(option?.playId ?? '') === code) return true
    return String(option?.name ?? '') === code
  }))
}

/**
 * 取注項的爆池權重
 * 順序：注項 weight → 群組 weight → 0（不參與分配）
 * 明確給 0 代表「排除」，與「沒設定」不同，故用 null 判斷而非 falsy
 */
export function sscOfJackpotWeightOf(playKey?: string, tabId?: number | string, betCode?: string | number): number {
  const code = String(betCode ?? '').trim()
  const tab = findSscOfTab(playKey, tabId)
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
  // 複式分頁的注碼不在清單裡，用該分頁第一個群組的 weight
  const first = groups[0]
  return first?.weight == null ? 0 : Number(first.weight)
}

/**
 * 展開複式分頁的注碼（前端送單前呼叫；伺端也用它對帳注數）
 *
 * @param picks 依位置排列的選號集合：
 *   direct —— picks[0] = 第一個位置選的號碼…（長度要等於 combo.positions）
 *   sides  —— 同上，但內容是 大／小／單／雙
 *   group  —— 只看 picks[0]，那一組號碼取 k 個
 * @returns 一注一碼的清單；規則不合（位置沒選滿、組選碼數不足）或超過
 *          SSC_OF_MAX_COMBO 上限回空陣列
 */
export function sscOfComboCodes(
  playKey?: string,
  tabId?: number | string,
  picks?: Array<Array<number | string>>
): string[] {
  const combo = sscOfComboOf(playKey, tabId)
  if (!combo) return []
  const sets = Array.isArray(picks) ? picks : []

  if (combo.mode === 'group') {
    const pool = sets[0]
    if (!Array.isArray(pool) || !combo.group) return []
    return sscGroupCombos(pool, combo.group).map((digits) => `${combo.prefix}${digits.join('')}`)
  }

  const positions = Number(combo.positions ?? 0)
  const used = sets.slice(0, positions)
  if (positions <= 0 || used.length !== positions) return []

  if (combo.mode === 'sides') {
    return sscSideCombos(used.map((list) => list.map((s) => String(s))))
      .map((sides) => `${combo.prefix}${sides.join('')}`)
  }
  return sscDirectCombos(used).map((digits) => `${combo.prefix}${digits.join('')}`)
}

/**
 * 複式分頁每個位置可選的號碼／面（給看板畫選號格）
 * @returns 依 pos 排好的群組；單選分頁回空陣列。
 *          digits 與 sides 只會有一邊有值，由 combo.mode 決定看哪個。
 */
export function sscOfComboGroups(
  playKey?: string,
  tabId?: number | string
): Array<{ pos: number; label: string; columns: number; digits: number[]; sides: string[] }> {
  const tab = findSscOfTab(playKey, tabId)
  if (!tab?.combo) return []
  return (Array.isArray(tab.tabGroup) ? tab.tabGroup : [])
    .map((group, idx) => {
      const list = Array.isArray(group.groupList) ? group.groupList : []
      return {
        pos: Number(group.pos ?? idx),
        label: String(group.groupName ?? ''),
        columns: Number(group.columns ?? 5),
        digits: list
          .map((option) => Number(option?.digit))
          .filter((digit) => Number.isInteger(digit) && digit >= 0 && digit <= SSC_DIGIT_MAX),
        sides: list.map((option) => String(option?.side ?? '')).filter((side) => side.length > 0)
      }
    })
    .sort((a, b) => a.pos - b.pos)
}
