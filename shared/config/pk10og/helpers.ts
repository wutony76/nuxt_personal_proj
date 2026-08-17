/**
 * PK10 官方盤看板設定的讀取層
 *
 * 結構與 shared/config/pk10cd/helpers.ts 一致：賠率與限額都以「分頁（tabId）設定」為主，
 * 取不到才退回全域預設；前端顯示 / clamp、伺端驗證 / 派彩全部走這裡。
 *
 * ── 兩種分頁型態 ────────────────────────────────────────
 *   單選分頁（前一直選／定位膽）—— groupList 就是注項清單，注碼＝name
 *   複式分頁（前二／前三直選）  —— groupList 只是「該名次可選的車號」，
 *                                注碼由 pk10DirectCombos() 展開，清單裡找不到，
 *                                所以驗證改走 combo 規則（見 pk10OgHasBetCode）
 *
 * ⚠️ 本檔 import pk10og.ts 與 pk10-of.ts，因此那兩支不可反向 import 本檔（會形成循環）。
 */
import C_PLAYS from '#shared/config/pk10og/plays'
import { pk10OgOddsOf, PK10OG_RTP_FALLBACK } from '#shared/config/pk10og'
import { pk10DirectCombos, pk10FirstTwoCode } from '#shared/config/pk10-of'
import { PK10_CAR_COUNT } from '#shared/config/pk10'

export type Pk10OgQuota = {
  /** 單注投注額 */
  item: { min: number; max: number }
  /** 單期投注額（同一玩家、同一期、同一分頁累計；max = 0 視為不限） */
  issue: { max: number }
}

/** 分頁未設定 quota 時的預設值 */
export const PK10OG_QUOTA_FALLBACK: Pk10OgQuota = {
  item: { min: 2, max: 10000 },
  issue: { max: 0 }
}

/**
 * 複式（直選）選號規則
 *   positions —— 幾個名次（前二 = 2、前三 = 3）
 *   prefix    —— 注碼前綴（僅賠率制用得到；pool 分頁的注碼是 codes 陣列）
 *   pool      —— true 代表該分頁走彩池分層，不吃 rtp 賠率
 */
export type Pk10OgCombo = {
  mode: 'direct'
  positions: number
  prefix: string
  pool: boolean
}

type ConfigOption = {
  playId?: string | number
  name?: string | number
  odds?: number
  weight?: number
  /** 該注項要畫的車號；判定不讀這裡，一律看 name（複式分頁則看 car） */
  car?: number
  rank?: number
}
type ConfigGroup = {
  groupName?: string
  groupList?: ConfigOption[]
  weight?: number
  /** 版面：本群組一列排幾個注項 */
  columns?: number
  /** 複式分頁：本群組對應第幾個名次（0 起算） */
  pos?: number
}
type ConfigTab = {
  tabId?: number
  tabName?: string
  settings?: {
    quota?: Partial<Pk10OgQuota>
    payout?: { rtp?: number; maxOdds?: number }
  }
  combo?: Pk10OgCombo
  tabGroup?: ConfigGroup[]
}
type ConfigPlay = { key?: string; name?: string; list?: ConfigTab[] }

const _plays = C_PLAYS as ConfigPlay[]

const _num = (value: unknown, fallback: number): number => {
  const num = Number(value)
  return Number.isFinite(num) && num >= 0 ? num : fallback
}

/** 玩法清單（給前端的玩法列用） */
export function pk10OgPlays(): ConfigPlay[] {
  return _plays
}

/** 取玩法設定（qianyi / qianer / qiansan / dingwei） */
export function findPk10OgPlay(playKey?: string): ConfigPlay | null {
  const key = String(playKey ?? '')
  if (!key) return null
  return _plays.find((play) => play.key === key) ?? null
}

/** 取分頁設定；tabId 給不出來時回該玩法第一個分頁 */
export function findPk10OgTab(playKey?: string, tabId?: number | string): ConfigTab | null {
  const play = findPk10OgPlay(playKey)
  if (!play?.list?.length) return null
  const id = Number(tabId)
  if (!Number.isFinite(id) || id <= 0) return play.list[0] ?? null
  return play.list.find((tab) => Number(tab.tabId) === id) ?? null
}

/** 該分頁的複式規則；單選分頁回 null */
export function pk10OgComboOf(playKey?: string, tabId?: number | string): Pk10OgCombo | null {
  return findPk10OgTab(playKey, tabId)?.combo ?? null
}

/** 該分頁是否走彩池分層（前三直選） */
export function pk10OgIsPoolTab(playKey?: string, tabId?: number | string): boolean {
  return pk10OgComboOf(playKey, tabId)?.pool === true
}

/** 取分頁的投注限額 */
export function pk10OgQuotaOf(playKey?: string, tabId?: number | string): Pk10OgQuota {
  const quota = findPk10OgTab(playKey, tabId)?.settings?.quota
  return {
    item: {
      min: _num(quota?.item?.min, PK10OG_QUOTA_FALLBACK.item.min),
      max: _num(quota?.item?.max, PK10OG_QUOTA_FALLBACK.item.max)
    },
    issue: { max: _num(quota?.issue?.max, PK10OG_QUOTA_FALLBACK.issue.max) }
  }
}

/** 取分頁設定的回報率 */
export function pk10OgRtpOf(playKey?: string, tabId?: number | string): number {
  const rtp = Number(findPk10OgTab(playKey, tabId)?.settings?.payout?.rtp)
  return Number.isFinite(rtp) && rtp > 0 ? rtp : PK10OG_RTP_FALLBACK
}

/** 取分頁設定的賠率上限（未設定回 0 表示不封頂） */
export function pk10OgMaxOddsOf(playKey?: string, tabId?: number | string): number {
  const maxOdds = Number(findPk10OgTab(playKey, tabId)?.settings?.payout?.maxOdds)
  return Number.isFinite(maxOdds) && maxOdds > 0 ? maxOdds : 0
}

/**
 * 取注碼賠率（含本金）
 *
 * 一律由 pk10og.ts 依「公平賠率 × 該分頁 rtp」推算，而不是讀 config 的 odds ——
 * config 的 odds 只是產生時的快照，改 rtp 就會與實際不符。
 * @returns 賠率；注碼無法辨識回 0（彩池分頁一律回 0，那邊不吃賠率）
 */
export function pk10OgTabOddsOf(playKey?: string, tabId?: number | string, betCode?: string | number): number {
  const code = String(betCode ?? '').trim()
  if (!code) return 0
  if (pk10OgIsPoolTab(playKey, tabId)) return 0
  const odds = pk10OgOddsOf(code, pk10OgRtpOf(playKey, tabId))
  if (!(odds > 0)) return 0
  const maxOdds = pk10OgMaxOddsOf(playKey, tabId)
  return maxOdds > 0 ? Math.min(odds, maxOdds) : odds
}

/**
 * 該注碼是否屬於指定分頁（伺端驗證用）
 *
 * 單選分頁：注碼要在 groupList 內。
 * 複式分頁：注碼由前端展開，清單裡沒有 —— 改驗「前綴符合該分頁的 combo 規則」，
 *          並且該注碼要能被 pk10og.ts 判定（賠率 > 0 即代表格式合法）。
 * ⚠️ 彩池分頁（前三直選）的注碼是 codes 陣列不是字串，不走這支 ——
 *    伺端改用 pk10OfPicksOf() 驗證，見 lotteryPK10Of.ts。
 */
export function pk10OgHasBetCode(playKey?: string, tabId?: number | string, betCode?: string | number): boolean {
  const code = String(betCode ?? '').trim()
  if (!code) return false
  const tab = findPk10OgTab(playKey, tabId)
  if (!tab) return false

  const combo = tab.combo
  if (combo) {
    // 彩池分頁不用字串注碼
    if (combo.pool) return false
    if (!code.startsWith(combo.prefix)) return false
    return pk10OgOddsOf(code, pk10OgRtpOf(playKey, tabId)) > 0
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
 */
export function pk10OgJackpotWeightOf(playKey?: string, tabId?: number | string, betCode?: string | number): number {
  const code = String(betCode ?? '').trim()
  const tab = findPk10OgTab(playKey, tabId)
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
 * 展開複式分頁的注單（前端送單前呼叫；伺端也用它對帳注數）
 *
 * @param picks 依名次排列的車號集合（picks[0] = 冠軍選的車號…）
 * @returns 每一注的車號陣列（順序即名次）；規則不合（名次沒選滿）回空陣列
 *
 * ⚠️ 回傳的是「車號陣列」而不是注碼字串，因為兩種分頁要的形狀不同：
 *      賠率制（前二）→ 再用 pk10OgComboCodes() 轉成 前二05-03
 *      彩池（前三）  → 直接把陣列放進注單的 codes
 */
export function pk10OgExpandCombo(
  playKey: string,
  tabId: number | string,
  picks: Array<Array<number | string>>
): number[][] {
  const combo = pk10OgComboOf(playKey, tabId)
  if (!combo) return []
  const sets = (Array.isArray(picks) ? picks : []).slice(0, combo.positions)
  if (sets.length !== combo.positions) return []
  return pk10DirectCombos(sets)
}

/**
 * 展開複式分頁的注碼字串（僅賠率制的複式分頁：前二直選）
 * @returns 一注一碼的清單；彩池分頁或規則不合回空陣列
 */
export function pk10OgComboCodes(
  playKey: string,
  tabId: number | string,
  picks: Array<Array<number | string>>
): string[] {
  const combo = pk10OgComboOf(playKey, tabId)
  if (!combo || combo.pool) return []
  const combos = pk10OgExpandCombo(playKey, tabId, picks)
  if (combo.positions === 2) return combos.map((cars) => pk10FirstTwoCode(cars)).filter((code) => code.length > 0)
  return []
}

/**
 * 複式分頁每個名次可選的車號（給看板畫選號格）
 * @returns 依 pos 排好的群組；單選分頁回空陣列
 */
export function pk10OgComboGroups(
  playKey?: string,
  tabId?: number | string
): Array<{ pos: number; label: string; cars: number[] }> {
  const tab = findPk10OgTab(playKey, tabId)
  if (!tab?.combo) return []
  return (Array.isArray(tab.tabGroup) ? tab.tabGroup : [])
    .map((group, idx) => ({
      pos: Number(group.pos ?? idx),
      label: String(group.groupName ?? ''),
      cars: (Array.isArray(group.groupList) ? group.groupList : [])
        .map((option) => Number(option?.car ?? 0))
        .filter((car) => car >= 1 && car <= PK10_CAR_COUNT)
    }))
    .sort((a, b) => a.pos - b.pos)
}
