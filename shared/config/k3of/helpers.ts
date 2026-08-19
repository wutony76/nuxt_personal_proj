/**
 * 快3 官方盤（賠率制）看板設定的讀取層
 *
 * 結構與 shared/config/k3cd/helpers.ts 一致：賠率與限額都以「分頁（tabId）設定」為主，
 * 取不到才退回全域預設；前端顯示 / clamp、伺端驗證 / 派彩全部走這裡。
 *
 * ⚠️ 本檔 import k3of.ts，因此 k3of.ts 不可反向 import 本檔（會形成循環）。
 *    k3of.ts 的判定需要設定值時一律由呼叫端傳入。
 */
import C_PLAYS from '#shared/config/k3of/plays'
import { k3OfOddsOf, k3OfComboCodes, K3OF_RTP_FALLBACK } from '#shared/config/k3of'

export type K3OfQuota = {
  /** 單注投注額 */
  item: { min: number; max: number }
  /** 單期投注額（同一玩家、同一期、同一分頁累計；max = 0 視為不限） */
  issue: { max: number }
}

/** 分頁未設定 quota 時的預設值 */
export const K3OF_QUOTA_FALLBACK: K3OfQuota = {
  item: { min: 2, max: 10000 },
  issue: { max: 0 }
}

/** 組合玩法的選號規則（標準 / 膽拖） */
export type K3OfCombo = {
  mode: 'standard' | 'dantuo'
  /** 一注幾個點數 */
  pick: number
  /** 注碼前綴（三不同 / 二不同） */
  prefix: '三不同' | '二不同'
  /** 膽碼上限（膽拖用；至少要留一個拖碼） */
  maxDan?: number
}

type ConfigOption = {
  playId?: string | number
  name?: string | number
  odds?: number
  weight?: number
  /** 該注項要畫幾顆骰子；判定不讀這裡，一律看 name */
  nums?: number[]
  /** 膽拖分頁用：dan / tuo */
  tag?: 'dan' | 'tuo'
}
type ConfigGroup = {
  groupName?: string
  groupTag?: 'dan' | 'tuo'
  groupList?: ConfigOption[]
  weight?: number
  /** 版面：本群組一列排幾個注項 */
  columns?: number
}
type ConfigTab = {
  tabId?: number
  tabName?: string
  settings?: {
    quota?: Partial<K3OfQuota>
    payout?: { rtp?: number; maxOdds?: number }
  }
  combo?: K3OfCombo
  tabGroup?: ConfigGroup[]
}
type ConfigPlay = { key?: string; name?: string; list?: ConfigTab[] }

const _plays = C_PLAYS as ConfigPlay[]

const _num = (value: unknown, fallback: number): number => {
  const num = Number(value)
  return Number.isFinite(num) && num >= 0 ? num : fallback
}

/** 玩法清單（給前端的分頁列用） */
export function k3OfPlays(): ConfigPlay[] {
  return _plays
}

/** 取玩法設定（hezhi / santong…） */
export function findK3OfPlay(playKey?: string): ConfigPlay | null {
  const key = String(playKey ?? '')
  if (!key) return null
  return _plays.find((play) => play.key === key) ?? null
}

/** 取分頁設定；tabId 給不出來時回該玩法第一個分頁 */
export function findK3OfTab(playKey?: string, tabId?: number | string): ConfigTab | null {
  const play = findK3OfPlay(playKey)
  if (!play?.list?.length) return null
  const id = Number(tabId)
  if (!Number.isFinite(id) || id <= 0) return play.list[0] ?? null
  return play.list.find((tab) => Number(tab.tabId) === id) ?? null
}

/** 該分頁的組合選號規則；非組合玩法回 null */
export function k3OfComboOf(playKey?: string, tabId?: number | string): K3OfCombo | null {
  return findK3OfTab(playKey, tabId)?.combo ?? null
}

/** 取分頁的投注限額 */
export function k3OfQuotaOf(playKey?: string, tabId?: number | string): K3OfQuota {
  const quota = findK3OfTab(playKey, tabId)?.settings?.quota
  return {
    item: {
      min: _num(quota?.item?.min, K3OF_QUOTA_FALLBACK.item.min),
      max: _num(quota?.item?.max, K3OF_QUOTA_FALLBACK.item.max)
    },
    issue: { max: _num(quota?.issue?.max, K3OF_QUOTA_FALLBACK.issue.max) }
  }
}

/** 取分頁設定的回報率 */
export function k3OfRtpOf(playKey?: string, tabId?: number | string): number {
  const rtp = Number(findK3OfTab(playKey, tabId)?.settings?.payout?.rtp)
  return Number.isFinite(rtp) && rtp > 0 ? rtp : K3OF_RTP_FALLBACK
}

/** 取分頁設定的賠率上限（未設定回 0 表示不封頂） */
export function k3OfMaxOddsOf(playKey?: string, tabId?: number | string): number {
  const maxOdds = Number(findK3OfTab(playKey, tabId)?.settings?.payout?.maxOdds)
  return Number.isFinite(maxOdds) && maxOdds > 0 ? maxOdds : 0
}

/**
 * 取注碼賠率（含本金）
 *
 * 一律由 k3of.ts 依「公平賠率 × 該分頁 rtp」推算，而不是讀 config 的 odds ——
 * config 的 odds 只是產生時的快照，改 rtp 就會與實際不符。
 * @returns 賠率；注碼無法辨識回 0
 */
export function k3OfTabOddsOf(playKey?: string, tabId?: number | string, betCode?: string | number): number {
  const code = String(betCode ?? '').trim()
  if (!code) return 0
  const odds = k3OfOddsOf(code, k3OfRtpOf(playKey, tabId))
  if (!(odds > 0)) return 0
  const maxOdds = k3OfMaxOddsOf(playKey, tabId)
  return maxOdds > 0 ? Math.min(odds, maxOdds) : odds
}

/**
 * 該注碼是否屬於指定分頁（伺端驗證用）
 *
 * 單選分頁：注碼要在 groupList 內。
 * 組合分頁：注碼由前端展開，清單裡沒有 —— 改驗「前綴與點數個數符合該分頁的 combo 規則」，
 *          並且該注碼要能被 k3of.ts 判定（k3OfTabOddsOf > 0 即代表格式合法）。
 */
export function k3OfHasBetCode(playKey?: string, tabId?: number | string, betCode?: string | number): boolean {
  const code = String(betCode ?? '').trim()
  if (!code) return false
  const tab = findK3OfTab(playKey, tabId)
  if (!tab) return false

  const combo = tab.combo
  if (combo) {
    if (!code.startsWith(combo.prefix)) return false
    const digits = code.slice(combo.prefix.length)
    if (digits.length !== combo.pick) return false
    return k3OfOddsOf(code, k3OfRtpOf(playKey, tabId)) > 0
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
export function k3OfJackpotWeightOf(playKey?: string, tabId?: number | string, betCode?: string | number): number {
  const code = String(betCode ?? '').trim()
  const tab = findK3OfTab(playKey, tabId)
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
  // 組合玩法的注碼不在清單裡，用該分頁第一個群組的 weight
  const first = groups[0]
  return first?.weight == null ? 0 : Number(first.weight)
}

/**
 * 展開組合分頁的注碼（前端送單前呼叫；伺端也用它驗證注數）
 * @returns 一注一碼的清單；規則不合（膽碼過多、選不滿）回空陣列
 */
export function k3OfExpandCombo(
  playKey: string,
  tabId: number | string,
  picks: { nums?: number[]; dan?: number[]; tuo?: number[] }
): string[] {
  const combo = k3OfComboOf(playKey, tabId)
  if (!combo) return []
  return k3OfComboCodes({
    prefix: combo.prefix,
    pick: combo.pick,
    nums: combo.mode === 'standard' ? picks.nums : undefined,
    dan: combo.mode === 'dantuo' ? picks.dan : undefined,
    tuo: combo.mode === 'dantuo' ? picks.tuo : undefined
  })
}
