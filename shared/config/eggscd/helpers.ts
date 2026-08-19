/**
 * PC蛋蛋看板設定的讀取層（結構與 k3cd/helpers.ts 一致）
 *
 * 賠率與限額都以「分頁（tabId）設定」為主，取不到才退回全域預設；
 * 前端顯示 / clamp、伺端驗證 / 派彩全部走這裡，避免各自解析 config。
 *
 * ⚠️ 本檔 import eggs-cd.ts，因此 eggs-cd.ts 不可反向 import 本檔（會形成循環）。
 *    eggs-cd.ts 的判定需要設定值時一律由呼叫端傳入。
 */
import C_PLAYS from '#shared/config/eggscd/plays'
import { eggsOddsOf, EGGS_RTP_FALLBACK } from '#shared/config/eggs-cd'

export type EggsQuota = {
  /** 單注投注額 */
  item: { min: number; max: number }
  /** 單期投注額（同一玩家、同一期累計；max = 0 視為不限） */
  issue: { max: number }
}

/** 分頁未設定 quota 時的預設值 */
export const EGGS_QUOTA_FALLBACK: EggsQuota = {
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
  columns?: number
  /** 爆池分配的群組層預設權重（注項的 weight 會覆寫它） */
  weight?: number
}
type ConfigTab = {
  tabId?: number
  tabName?: string
  settings?: {
    quota?: Partial<EggsQuota>
    /** rtp：賠率由 1000 種結果的公平值 × rtp 推算，config 的 odds 只是快照 */
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

/** 取玩法設定（daxiao / danshuang / tese / sebo / tema） */
export function findEggsPlay(playKey?: string): ConfigPlay | null {
  const key = String(playKey ?? '')
  if (!key) return null
  return _plays.find((play) => play.key === key) ?? null
}

/** 取分頁設定；tabId 給不出來時回該玩法第一個分頁 */
export function findEggsTab(playKey?: string, tabId?: number | string): ConfigTab | null {
  const play = findEggsPlay(playKey)
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
  const groups = findEggsTab(playKey, tabId)?.tabGroup
  for (const group of Array.isArray(groups) ? groups : []) {
    const list = Array.isArray(group?.groupList) ? group.groupList : []
    const item = list.find((option) => {
      if (String(option?.playId ?? '') === code) return true
      const name = String(option?.name ?? '')
      // 特碼是數字型注項，可能未補零／帶空白，改比數值
      if (/^\d+$/.test(name) && /^\d+$/.test(code)) return Number(name) === Number(code)
      return name === code
    })
    if (item) return { group, item }
  }
  return null
}

/** 遍歷所有分頁找注項（不知道 playKey/tabId 時用，例如伺端只拿到 betCode） */
function _findAnyTabItem(betCode?: string | number): { playKey: string; tabId: number; item: ConfigOption } | null {
  const code = String(betCode ?? '').trim()
  if (!code) return null
  for (const play of _plays) {
    for (const tab of Array.isArray(play.list) ? play.list : []) {
      const found = _findTabItem(play.key, tab.tabId, code)
      if (found) return { playKey: String(play.key ?? ''), tabId: Number(tab.tabId ?? 0), item: found.item }
    }
  }
  return null
}

/** 取分頁的投注限額 */
export function eggsQuotaOf(playKey?: string, tabId?: number | string): EggsQuota {
  const quota = findEggsTab(playKey, tabId)?.settings?.quota
  return {
    item: {
      min: _num(quota?.item?.min, EGGS_QUOTA_FALLBACK.item.min),
      max: _num(quota?.item?.max, EGGS_QUOTA_FALLBACK.item.max)
    },
    issue: { max: _num(quota?.issue?.max, EGGS_QUOTA_FALLBACK.issue.max) }
  }
}

/** 取分頁設定的回報率 */
export function eggsRtpOf(playKey?: string, tabId?: number | string): number {
  const rtp = Number(findEggsTab(playKey, tabId)?.settings?.payout?.rtp)
  return Number.isFinite(rtp) && rtp > 0 ? rtp : EGGS_RTP_FALLBACK
}

/** 取分頁設定的賠率上限（未設定回 0 表示不封頂） */
export function eggsMaxOddsOf(playKey?: string, tabId?: number | string): number {
  const maxOdds = Number(findEggsTab(playKey, tabId)?.settings?.payout?.maxOdds)
  return Number.isFinite(maxOdds) && maxOdds > 0 ? maxOdds : 0
}

/**
 * 取注項賠率（含本金）
 *
 * 一律由 eggs-cd.ts 依「公平賠率 × 該分頁 rtp」推算，而不是讀 config 的 odds ——
 * config 的 odds 只是產生時的快照，改 rtp 就會與實際不符。
 * @returns 賠率；注項不在該分頁或無法辨識回 0
 */
export function eggsTabOddsOf(playKey?: string, tabId?: number | string, betCode?: string | number): number {
  const found = _findTabItem(playKey, tabId, betCode)
  if (!found) return 0
  const name = String(found.item.name ?? '')
  const odds = eggsOddsOf(name, eggsRtpOf(playKey, tabId))
  if (!(odds > 0)) return 0
  const maxOdds = eggsMaxOddsOf(playKey, tabId)
  return maxOdds > 0 ? Math.min(odds, maxOdds) : odds
}

/** 該注項是否存在於指定分頁（伺端驗證用） */
export function eggsHasBetCode(playKey?: string, tabId?: number | string, betCode?: string | number): boolean {
  return _findTabItem(playKey, tabId, betCode) !== null
}

/** 依 playId／name 找到注項所在的 playKey/tabId（伺端結算只存得到 betCode 時用） */
export function eggsFindPlayLocation(betCode?: string | number): { playKey: string; tabId: number } | null {
  const found = _findAnyTabItem(betCode)
  return found ? { playKey: found.playKey, tabId: found.tabId } : null
}

/**
 * 取注項的爆池分配權重
 *
 * 順序：注項 weight → 群組 weight → 0（不參與分配）
 * ⚠️ 明確給 0 代表「該注項排除在爆池外」，與「沒設定」（呼叫端會退回
 *    EGGS_JACKPOT_SETTINGS.weightFallback）是兩件不同的事，故用 null 判斷而非 falsy。
 * @returns 權重；注項不在該分頁或無法辨識回 0
 */
export function eggsJackpotWeightOf(playKey?: string, tabId?: number | string, betCode?: string | number): number {
  const found = _findTabItem(playKey, tabId, betCode)
  if (!found) return 0
  const itemWeight = found.item.weight == null ? null : Number(found.item.weight)
  if (itemWeight != null && Number.isFinite(itemWeight) && itemWeight >= 0) return itemWeight
  const groupWeight = found.group.weight == null ? null : Number(found.group.weight)
  if (groupWeight != null && Number.isFinite(groupWeight) && groupWeight >= 0) return groupWeight
  return 0
}
