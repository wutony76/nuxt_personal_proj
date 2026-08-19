/**
 * 11選5 信用盤看板設定的讀取層（結構與 shared/config/ssccd/helpers.ts 一致）
 *
 * 賠率與限額都以「分頁（tabId）設定」為主，取不到才退回全域預設；
 * 前端顯示 / clamp、伺端驗證 / 派彩全部走這裡，避免各自解析 config。
 *
 * ⚠️ 本檔 import x5-cd.ts，因此 x5-cd.ts 不可反向 import 本檔（會形成循環）。
 *    x5-cd.ts 的判定需要設定值時一律由呼叫端傳入。
 */
import C_PLAYS from '#shared/config/x5cd/plays'
import { x5OddsOf, X5_RTP_FALLBACK } from '#shared/config/x5-cd'

export type X5Quota = {
  /** 單注投注額 */
  item: { min: number; max: number }
  /** 單期投注額（同一玩家、同一期、同一分頁累計；max = 0 視為不限） */
  issue: { max: number }
}

/** 分頁未設定 quota 時的預設值 */
export const X5_QUOTA_FALLBACK: X5Quota = {
  item: { min: 1, max: 99999 },
  issue: { max: 0 }
}

type ConfigOption = {
  playId?: string | number
  name?: string | number
  odds?: number
  weight?: number
}
type ConfigGroup = {
  groupName?: string
  groupList?: ConfigOption[]
  weight?: number
  /** 版面：本群組一列排幾個注項 */
  columns?: number
}
type ConfigTab = {
  tabId?: number
  tabName?: string
  settings?: {
    quota?: Partial<X5Quota>
    /** rtp：賠率由該注項的樣本空間推公平值後 × rtp，config 的 odds 只是快照 */
    payout?: { rtp?: number; maxOdds?: number }
  }
  tabGroup?: ConfigGroup[]
}
type ConfigPlay = { key?: string; name?: string; list?: ConfigTab[] }

const _plays = C_PLAYS as ConfigPlay[]

const _num = (value: unknown, fallback: number): number => {
  const num = Number(value)
  return Number.isFinite(num) && num >= 0 ? num : fallback
}

/** 玩法清單（給前端的玩法列用） */
export function x5Plays(): ConfigPlay[] {
  return _plays
}

/** 取玩法設定（ball / liangmian / longhu / quan5） */
export function findX5Play(playKey?: string): ConfigPlay | null {
  const key = String(playKey ?? '')
  if (!key) return null
  return _plays.find((play) => play.key === key) ?? null
}

/** 取分頁設定；tabId 給不出來時回該玩法第一個分頁 */
export function findX5Tab(playKey?: string, tabId?: number | string): ConfigTab | null {
  const play = findX5Play(playKey)
  if (!play?.list?.length) return null
  const id = Number(tabId)
  if (!Number.isFinite(id) || id <= 0) return play.list[0] ?? null
  return play.list.find((tab) => Number(tab.tabId) === id) ?? null
}

/** 以注項名稱（或 playId）找設定項 */
function _findTabItem(
  playKey?: string,
  tabId?: number | string,
  betCode?: string | number
): { group: ConfigGroup; item: ConfigOption } | null {
  const code = String(betCode ?? '').trim()
  if (!code) return null
  const groups = findX5Tab(playKey, tabId)?.tabGroup
  for (const group of Array.isArray(groups) ? groups : []) {
    const list = Array.isArray(group?.groupList) ? group.groupList : []
    const item = list.find((option) => {
      if (String(option?.playId ?? '') === code) return true
      return String(option?.name ?? '') === code
    })
    if (item) return { group, item }
  }
  return null
}

/** 取分頁的投注限額 */
export function x5QuotaOf(playKey?: string, tabId?: number | string): X5Quota {
  const quota = findX5Tab(playKey, tabId)?.settings?.quota
  return {
    item: {
      min: _num(quota?.item?.min, X5_QUOTA_FALLBACK.item.min),
      max: _num(quota?.item?.max, X5_QUOTA_FALLBACK.item.max)
    },
    issue: { max: _num(quota?.issue?.max, X5_QUOTA_FALLBACK.issue.max) }
  }
}

/** 取分頁設定的回報率 */
export function x5RtpOf(playKey?: string, tabId?: number | string): number {
  const rtp = Number(findX5Tab(playKey, tabId)?.settings?.payout?.rtp)
  return Number.isFinite(rtp) && rtp > 0 ? rtp : X5_RTP_FALLBACK
}

/** 取分頁設定的賠率上限（未設定回 0 表示不封頂） */
export function x5MaxOddsOf(playKey?: string, tabId?: number | string): number {
  const maxOdds = Number(findX5Tab(playKey, tabId)?.settings?.payout?.maxOdds)
  return Number.isFinite(maxOdds) && maxOdds > 0 ? maxOdds : 0
}

/**
 * 取注項賠率（含本金）
 *
 * 一律由 x5-cd.ts 依「公平賠率 × 該分頁 rtp」推算，而不是讀 config 的 odds ——
 * config 的 odds 只是產生時的快照，改 rtp 就會與實際不符。
 * 若分頁設了 maxOdds 則夾到上限（該注項的實際 RTP 會低於 rtp）。
 * @returns 賠率；注項不在該分頁或無法辨識回 0
 */
export function x5TabOddsOf(playKey?: string, tabId?: number | string, betCode?: string | number): number {
  const found = _findTabItem(playKey, tabId, betCode)
  if (!found) return 0
  const name = String(found.item.name ?? '')
  const odds = x5OddsOf(name, x5RtpOf(playKey, tabId))
  if (!(odds > 0)) return 0
  const maxOdds = x5MaxOddsOf(playKey, tabId)
  return maxOdds > 0 ? Math.min(odds, maxOdds) : odds
}

/**
 * 取注項的爆池權重
 * 順序：注項 weight → 群組 weight → 0（不參與分配）
 * 明確給 0 代表「排除」，與「沒設定」不同，故用 null 判斷而非 falsy
 */
export function x5JackpotWeightOf(playKey?: string, tabId?: number | string, betCode?: string | number): number {
  const found = _findTabItem(playKey, tabId, betCode)
  if (!found) return 0
  const itemWeight = found.item.weight == null ? null : Number(found.item.weight)
  if (itemWeight != null && Number.isFinite(itemWeight) && itemWeight >= 0) return itemWeight
  const groupWeight = found.group.weight == null ? null : Number(found.group.weight)
  if (groupWeight != null && Number.isFinite(groupWeight) && groupWeight >= 0) return groupWeight
  return 0
}

/** 該注項是否存在於指定分頁（伺端驗證用） */
export function x5HasBetCode(playKey?: string, tabId?: number | string, betCode?: string | number): boolean {
  return _findTabItem(playKey, tabId, betCode) !== null
}
