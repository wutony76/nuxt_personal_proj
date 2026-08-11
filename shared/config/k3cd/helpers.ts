/**
 * 快3 看板設定的讀取層（結構與 shared/config/cd/helpers.ts 一致）
 *
 * 賠率與限額都以「分頁（tabId）設定」為主，取不到才退回全域預設；
 * 前端顯示 / clamp、伺端驗證 / 派彩全部走這裡，避免各自解析 config。
 *
 * ⚠️ 本檔 import k3-cd.ts，因此 k3-cd.ts 不可反向 import 本檔（會形成循環）。
 *    k3-cd.ts 的判定需要設定值時一律由呼叫端傳入。
 */
import C_PLAYS from '#shared/config/k3cd/plays'
import { k3OddsOf, K3_RTP_FALLBACK } from '#shared/config/k3-cd'

export type K3Quota = {
  /** 單注投注額 */
  item: { min: number; max: number }
  /** 單期投注額（同一玩家、同一期、同一分頁累計；max = 0 視為不限） */
  issue: { max: number }
}

/** 分頁未設定 quota 時的預設值 */
export const K3_QUOTA_FALLBACK: K3Quota = {
  item: { min: 1, max: 99999 },
  issue: { max: 0 }
}

type ConfigOption = {
  playId?: string | number
  name?: string | number
  odds?: number
  weight?: number
}
type ConfigGroup = { groupName?: string; groupList?: ConfigOption[]; weight?: number }
type ConfigTab = {
  tabId?: number
  tabName?: string
  settings?: {
    quota?: Partial<K3Quota>
    /** rtp：賠率由 216 種結果的公平值 × rtp 推算，config 的 odds 只是快照 */
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

/** 取玩法設定（hezhi / daxiao…） */
export function findK3Play(playKey?: string): ConfigPlay | null {
  const key = String(playKey ?? '')
  if (!key) return null
  return _plays.find((play) => play.key === key) ?? null
}

/** 取分頁設定；tabId 給不出來時回該玩法第一個分頁 */
export function findK3Tab(playKey?: string, tabId?: number | string): ConfigTab | null {
  const play = findK3Play(playKey)
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
  const groups = findK3Tab(playKey, tabId)?.tabGroup
  for (const group of Array.isArray(groups) ? groups : []) {
    const list = Array.isArray(group?.groupList) ? group.groupList : []
    const item = list.find((option) => {
      if (String(option?.playId ?? '') === code) return true
      const name = String(option?.name ?? '')
      // 和值可能未補零／帶空白，數字型注項改比數值
      if (/^\d+$/.test(name) && /^\d+$/.test(code)) return Number(name) === Number(code)
      return name === code
    })
    if (item) return { group, item }
  }
  return null
}

/** 取分頁的投注限額 */
export function k3QuotaOf(playKey?: string, tabId?: number | string): K3Quota {
  const quota = findK3Tab(playKey, tabId)?.settings?.quota
  return {
    item: {
      min: _num(quota?.item?.min, K3_QUOTA_FALLBACK.item.min),
      max: _num(quota?.item?.max, K3_QUOTA_FALLBACK.item.max)
    },
    issue: { max: _num(quota?.issue?.max, K3_QUOTA_FALLBACK.issue.max) }
  }
}

/** 取分頁設定的回報率 */
export function k3RtpOf(playKey?: string, tabId?: number | string): number {
  const rtp = Number(findK3Tab(playKey, tabId)?.settings?.payout?.rtp)
  return Number.isFinite(rtp) && rtp > 0 ? rtp : K3_RTP_FALLBACK
}

/** 取分頁設定的賠率上限（未設定回 0 表示不封頂） */
export function k3MaxOddsOf(playKey?: string, tabId?: number | string): number {
  const maxOdds = Number(findK3Tab(playKey, tabId)?.settings?.payout?.maxOdds)
  return Number.isFinite(maxOdds) && maxOdds > 0 ? maxOdds : 0
}

/**
 * 取注項賠率（含本金）
 *
 * 一律由 k3-cd.ts 依「公平賠率 × 該分頁 rtp」推算，而不是讀 config 的 odds ——
 * config 的 odds 只是產生時的快照，改 rtp 就會與實際不符。
 * 若分頁設了 maxOdds 則夾到上限（該注項的實際 RTP 會低於 rtp）。
 * @returns 賠率；注項不在該分頁或無法辨識回 0
 */
export function k3TabOddsOf(playKey?: string, tabId?: number | string, betCode?: string | number): number {
  const found = _findTabItem(playKey, tabId, betCode)
  if (!found) return 0
  const name = String(found.item.name ?? '')
  const odds = k3OddsOf(name, k3RtpOf(playKey, tabId))
  if (!(odds > 0)) return 0
  const maxOdds = k3MaxOddsOf(playKey, tabId)
  return maxOdds > 0 ? Math.min(odds, maxOdds) : odds
}

/**
 * 取注項的爆池權重
 * 順序：注項 weight → 群組 weight → 0（不參與分配）
 * 明確給 0 代表「排除」，與「沒設定」不同，故用 null 判斷而非 falsy
 */
export function k3JackpotWeightOf(playKey?: string, tabId?: number | string, betCode?: string | number): number {
  const found = _findTabItem(playKey, tabId, betCode)
  if (!found) return 0
  const itemWeight = found.item.weight == null ? null : Number(found.item.weight)
  if (itemWeight != null && Number.isFinite(itemWeight) && itemWeight >= 0) return itemWeight
  const groupWeight = found.group.weight == null ? null : Number(found.group.weight)
  if (groupWeight != null && Number.isFinite(groupWeight) && groupWeight >= 0) return groupWeight
  return 0
}

/** 該注項是否存在於指定分頁（伺端驗證用） */
export function k3HasBetCode(playKey?: string, tabId?: number | string, betCode?: string | number): boolean {
  return _findTabItem(playKey, tabId, betCode) !== null
}
