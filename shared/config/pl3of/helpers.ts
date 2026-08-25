/**
 * 排列3官方盤看板設定的讀取層
 *
 * 結構比照 shared/config/sscof/helpers.ts：賠率與限額都以「分頁（tabId）設定」為主，
 * 取不到才退回全域預設；前端顯示 / clamp、伺端驗證 / 派彩全部走這裡。
 * 三星直選複式／單式改吃分層彩池後新增 `pl3OfIsPoolTab`／`pl3JackpotWeightOf`
 * （比照 sscOfIsPoolTab／sscOfJackpotWeightOf），詳見 openspec/changes/add-pl3-jackpot/。
 *
 * ── 分頁型態 ────────────────────────────────────────────
 *   單選分頁（定位膽）—— groupList 就是注項清單，注碼＝name（百位0…）
 *   複式分頁（其餘）—— groupList 只是「該位置／該組可選的號碼或面」，
 *                     注碼由 pl3ComboCodes() 展開，清單裡沒有，改驗 combo 規則。
 *
 * ── 複式的五種展開（對應 pl3-of.ts）──────────────────────
 *   direct 位置直選（前二/後二/三星）→ 各位置選一組號碼，笛卡爾積
 *   group  組選（組選2/組三/組六、二碼不定位）→ 一組號碼取合法組合
 *   sides  大小單雙（前二/後二）→ 各位置選一組面，笛卡爾積
 *   each   逐項（和值、一碼不定位）→ 每個選號各自成一注
 *   input  三星直選單式 → 前端輸入框直接給注碼，不走展開函式（pl3ComboCodes 回空陣列）
 *
 * ⚠️ `三星直選` 是 `三星直選和值` 的前綴，光比對前綴會讓和值注碼誤過直選分頁驗證，
 *    故 pl3HasBetCode 額外用 _matchesCombo 檢查「解析出的注碼種類」與分頁一致。
 * ⚠️ 本檔 import pl3-of.ts，因此 pl3-of.ts 不可反向 import 本檔（會形成循環）。
 */
import C_PLAYS from '#shared/config/pl3of/plays'
import {
  pl3OddsOf,
  pl3KindOf,
  pl3DirectCombos,
  pl3GroupCombos,
  pl3SideCombos,
  PL3_RTP_FALLBACK,
  type Pl3OfSection
} from '#shared/config/pl3-of'
import { PL3_SUM_MAX } from '#shared/config/pl3'

export type Pl3OfQuota = {
  /** 單注投注額 */
  item: { min: number; max: number }
  /** 單期投注額（同一玩家、同一期、同一分頁累計；max = 0 視為不限） */
  issue: { max: number }
}

/** 分頁未設定 quota 時的預設值 */
export const PL3_QUOTA_FALLBACK: Pl3OfQuota = {
  item: { min: 2, max: 10000 },
  issue: { max: 0 }
}

/** 組選型態（對應 pl3-of.ts 的 pl3GroupCombos） */
export type Pl3OfGroupMode = 'group2' | 'group3' | 'group6'

/**
 * 複式選號規則
 *   mode      —— direct（位置直選）／group（組選）／sides（大小單雙）／each（逐項和值·不定位）／input（單式輸入）
 *   prefix    —— 注碼前綴（前二直選、三星組三、三星直選和值、大小單雙後二…）
 *   section   —— direct / sides 對應的區段（決定看哪幾個號碼位）
 *   positions —— direct / sides / input 有幾個位置
 *   group     —— group 模式的組選型態
 *   minPick   —— 每個位置（group / each 為該組）至少要選幾個，給看板擋送單用
 */
export type Pl3OfCombo = {
  mode: 'direct' | 'group' | 'sides' | 'each' | 'input'
  prefix: string
  section?: Pl3OfSection
  positions?: number
  group?: Pl3OfGroupMode
  minPick: number
  /** 三星直選複式／單式改吃分層彩池時為 true（見 pl3-of.ts PL3_OF_PRIZE_TIERS） */
  pool?: boolean
}

type ConfigOption = {
  playId?: string | number
  name?: string | number
  odds?: number
  weight?: number
  /** 該注項的號碼（0~9）；判定不讀這裡，複式分頁由 combo 展開 */
  digit?: number
  /** 該注項的數值（號碼 0~9 或和值 0~27）；供看板渲染用 */
  value?: number
  /** 該注項的面（大小單雙分頁用） */
  side?: string
  /** 定位膽注項屬於第幾個位置（0 起算）；只供畫面用 */
  place?: number
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
    quota?: Partial<Pl3OfQuota>
    /** rtp：賠率由該注碼的樣本空間推公平值後 × rtp，config 的 odds 只是快照 */
    payout?: { rtp?: number; maxOdds?: number }
  }
  combo?: Pl3OfCombo
  tabGroup?: ConfigGroup[]
}
type ConfigPlay = { key?: string; name?: string; list?: ConfigTab[] }

const _plays = C_PLAYS as ConfigPlay[]

const _num = (value: unknown, fallback: number): number => {
  const num = Number(value)
  return Number.isFinite(num) && num >= 0 ? num : fallback
}

/** 玩法清單（給前端的玩法列用） */
export function pl3Plays(): ConfigPlay[] {
  return _plays
}

/** 取玩法設定（dingwei / zhixuan / sanxing / budingwei / daxiao） */
export function findPl3Play(playKey?: string): ConfigPlay | null {
  const key = String(playKey ?? '')
  if (!key) return null
  return _plays.find((play) => play.key === key) ?? null
}

/** 取分頁設定；tabId 給不出來時回該玩法第一個分頁 */
export function findPl3Tab(playKey?: string, tabId?: number | string): ConfigTab | null {
  const play = findPl3Play(playKey)
  if (!play?.list?.length) return null
  const id = Number(tabId)
  if (!Number.isFinite(id) || id <= 0) return play.list[0] ?? null
  return play.list.find((tab) => Number(tab.tabId) === id) ?? null
}

/** 該分頁的複式規則；單選分頁（定位膽）回 null */
export function pl3ComboOf(playKey?: string, tabId?: number | string): Pl3OfCombo | null {
  return findPl3Tab(playKey, tabId)?.combo ?? null
}

/**
 * 該分頁是否走分層彩池（三星直選複式／單式）
 * ⚠️ 比照 sscOfIsPoolTab：注碼展開／驗證不必為吃池分頁開特例，只有派彩方式不一樣。
 */
export function pl3OfIsPoolTab(playKey?: string, tabId?: number | string): boolean {
  return pl3ComboOf(playKey, tabId)?.pool === true
}

/** 取分頁的投注限額 */
export function pl3QuotaOf(playKey?: string, tabId?: number | string): Pl3OfQuota {
  const quota = findPl3Tab(playKey, tabId)?.settings?.quota
  return {
    item: {
      min: _num(quota?.item?.min, PL3_QUOTA_FALLBACK.item.min),
      max: _num(quota?.item?.max, PL3_QUOTA_FALLBACK.item.max)
    },
    issue: { max: _num(quota?.issue?.max, PL3_QUOTA_FALLBACK.issue.max) }
  }
}

/** 取分頁設定的回報率 */
export function pl3RtpOf(playKey?: string, tabId?: number | string): number {
  const rtp = Number(findPl3Tab(playKey, tabId)?.settings?.payout?.rtp)
  return Number.isFinite(rtp) && rtp > 0 ? rtp : PL3_RTP_FALLBACK
}

/** 取分頁設定的賠率上限（未設定回 0 表示不封頂） */
export function pl3MaxOddsOf(playKey?: string, tabId?: number | string): number {
  const maxOdds = Number(findPl3Tab(playKey, tabId)?.settings?.payout?.maxOdds)
  return Number.isFinite(maxOdds) && maxOdds > 0 ? maxOdds : 0
}

/** 解析出的注碼種類是否與該分頁的 combo 規則一致（防止前綴巢狀誤判，見檔頭說明） */
function _matchesCombo(combo: Pl3OfCombo, betCode: string): boolean {
  const kind = pl3KindOf(betCode)
  if (!kind) return false
  switch (combo.mode) {
    case 'direct':
    case 'input':
      return kind === 'direct'
    case 'sides':
      return kind === 'sides'
    case 'group':
      if (combo.group === 'group3') return kind === 'group3'
      if (combo.group === 'group6') return kind === 'group6'
      // group2 同時用於「前二/後二組選」與「二碼不定位」，靠 prefix 再區分
      return kind === 'group2' || kind === 'unpositioned2'
    case 'each':
      return kind === 'sumValue' || kind === 'groupSumValue' || kind === 'unpositioned1'
  }
}

/**
 * 該注碼是否屬於指定分頁（伺端驗證用）
 *
 * 單選分頁：注碼要在 groupList 內。
 * 複式分頁：注碼由前端展開、清單裡沒有 —— 改驗「前綴符合 + 解析種類符合 + 能被 pl3-of.ts 判定
 *          （pl3OddsOf > 0，等同 pl3ChanceOf() !== null 且命中數 > 0）」。
 */
export function pl3HasBetCode(playKey?: string, tabId?: number | string, betCode?: string | number): boolean {
  const code = String(betCode ?? '').trim()
  if (!code) return false
  const tab = findPl3Tab(playKey, tabId)
  if (!tab) return false

  const combo = tab.combo
  if (combo) {
    if (!code.startsWith(combo.prefix)) return false
    if (!_matchesCombo(combo, code)) return false
    return pl3OddsOf(code, pl3RtpOf(playKey, tabId)) > 0
  }

  const groups = Array.isArray(tab.tabGroup) ? tab.tabGroup : []
  return groups.some((group) => (Array.isArray(group.groupList) ? group.groupList : []).some((option) => {
    if (String(option?.playId ?? '') === code) return true
    return String(option?.name ?? '') === code
  }))
}

/**
 * 取注碼賠率（含本金）
 *
 * 一律由 pl3-of.ts 依「公平賠率 × 該分頁 rtp」推算，而不是讀 config 的 odds ——
 * config 的 odds 只是產生時的快照，改 rtp 就會與實際不符。
 * @returns 賠率；注碼無法辨識或不屬於該分頁回 0（吃分層彩池的分頁一律回 0，那邊不吃賠率）
 */
export function pl3TabOddsOf(playKey?: string, tabId?: number | string, betCode?: string | number): number {
  const code = String(betCode ?? '').trim()
  if (!code || !pl3HasBetCode(playKey, tabId, code)) return 0
  if (pl3OfIsPoolTab(playKey, tabId)) return 0
  const odds = pl3OddsOf(code, pl3RtpOf(playKey, tabId))
  if (!(odds > 0)) return 0
  const maxOdds = pl3MaxOddsOf(playKey, tabId)
  return maxOdds > 0 ? Math.min(odds, maxOdds) : odds
}

/**
 * 取注項的全站爆池分配權重（比照 sscOfJackpotWeightOf／eggsJackpotWeightOf）
 *
 * 順序：注項 weight → 群組 weight → 0（不參與分配）；
 * 複式分頁的注碼不在清單裡（例如「三星直選123」），退回該分頁第一個群組的 weight。
 * ⚠️ 明確給 0 代表「排除」，與「沒設定」（呼叫端會退回 PL3_JACKPOT_SETTINGS.weightFallback）
 *    是兩件不同的事，故用 null 判斷而非 falsy。
 */
export function pl3JackpotWeightOf(playKey?: string, tabId?: number | string, betCode?: string | number): number {
  const code = String(betCode ?? '').trim()
  const tab = findPl3Tab(playKey, tabId)
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
 * 展開複式分頁的注碼（前端送單前呼叫；伺端也用它對帳注數）
 *
 * @param picks 依位置排列的選號集合：
 *   direct / sides —— picks[0] = 第一個位置選的號碼／面…（長度要等於 combo.positions）
 *   group          —— 只看 picks[0]，那一組號碼取合法組合
 *   each           —— 跨群組攤平，每個選號各自成一注（和值、一碼不定位）
 *   input          —— 回空陣列（單式由前端輸入注碼，不在此展開）
 * @returns 一注一碼的清單；規則不合或超過 PL3_MAX_COMBO 上限回空陣列
 */
export function pl3ComboCodes(
  playKey?: string,
  tabId?: number | string,
  picks?: Array<Array<number | string>>
): string[] {
  const combo = pl3ComboOf(playKey, tabId)
  if (!combo) return []
  const sets = Array.isArray(picks) ? picks : []

  if (combo.mode === 'input') return []

  if (combo.mode === 'each') {
    const values = Array.from(new Set(sets.flat().map((n) => Number(n))))
      .filter((n) => Number.isInteger(n) && n >= 0)
      .sort((a, b) => a - b)
    return values.map((v) => `${combo.prefix}${v}`)
  }

  if (combo.mode === 'group') {
    const pool = sets[0]
    if (!Array.isArray(pool) || !combo.group) return []
    return pl3GroupCombos(pool, combo.group).map((digits) => `${combo.prefix}${digits.join('')}`)
  }

  const positions = Number(combo.positions ?? 0)
  const used = sets.slice(0, positions)
  if (positions <= 0 || used.length !== positions) return []

  if (combo.mode === 'sides') {
    return pl3SideCombos(used.map((list) => list.map((s) => String(s))))
      .map((sides) => `${combo.prefix}${sides.join('')}`)
  }
  return pl3DirectCombos(used).map((digits) => `${combo.prefix}${digits.join('')}`)
}

/**
 * 複式分頁每個位置可選的號碼／和值／面（給看板畫選號格）
 * @returns 依 pos 排好的群組；單選分頁（定位膽）回空陣列。
 *          values 與 sides 只會有一邊有值，由 combo.mode 決定看哪個
 *          （values 含號碼 0~9 或和值 0~27，故上限用 PL3_SUM_MAX）。
 */
export function pl3ComboGroups(
  playKey?: string,
  tabId?: number | string
): Array<{ pos: number; label: string; columns: number; values: number[]; sides: string[] }> {
  const tab = findPl3Tab(playKey, tabId)
  if (!tab?.combo) return []
  return (Array.isArray(tab.tabGroup) ? tab.tabGroup : [])
    .map((group, idx) => {
      const list = Array.isArray(group.groupList) ? group.groupList : []
      return {
        pos: Number(group.pos ?? idx),
        label: String(group.groupName ?? ''),
        columns: Number(group.columns ?? 5),
        values: list
          .map((option) => Number(option?.value ?? option?.digit))
          .filter((v) => Number.isInteger(v) && v >= 0 && v <= PL3_SUM_MAX),
        sides: list.map((option) => String(option?.side ?? '')).filter((side) => side.length > 0)
      }
    })
    .sort((a, b) => a.pos - b.pos)
}
