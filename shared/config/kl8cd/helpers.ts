/**
 * 快樂8看板設定的讀取層（結構與 kl10cd/helpers.ts 一致）
 *
 * 賠率與限額都以「分頁（tabId）設定」為主，取不到才退回全域預設；
 * 前端顯示 / clamp、伺端驗證 / 派彩全部走這裡，避免各自解析 config。
 *
 * ⚠️ 本檔 import kl8-cd.ts，因此 kl8-cd.ts 不可反向 import 本檔（會形成循環）。
 *    kl8-cd.ts 的判定需要設定值時一律由呼叫端傳入。
 *
 * ── 與 kl10cd 那份最大的差異：任選是「一注多碼」 ──────────────
 *   任選的注碼是動態組合（`任三中三03,07,15`），設定檔只宣告分頁本身那一個注項（`任三中三`），
 *   所以注項查找是兩段式（見 `_resolveItem`）：先比對 playId／name，
 *   再對任選走「注碼以注項名稱開頭且 kind 為 renxuan」的前綴比對。
 */
import C_PLAYS from '#shared/config/kl8cd/plays'
import { kl8ChanceOf, kl8KindOf, kl8OddsOf, KL8_RTP_FALLBACK } from '#shared/config/kl8-cd'

export type Kl8Quota = {
  /** 單注投注額 */
  item: { min: number; max: number }
  /** 單期投注額（同一玩家、同一期同分頁累計；max = 0 視為不限） */
  issue: { max: number }
}

/** 任選的選號張數限制（min ≤ 已選號碼數 ≤ max；pick = 一注幾碼） */
export type Kl8Chosen = { min: number; max: number; pick: number }

/** 分頁未設定 quota 時的預設值 */
export const KL8_QUOTA_FALLBACK: Kl8Quota = {
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
    quota?: Partial<Kl8Quota>
    /** rtp：賠率由母數／命中數的公平值 × rtp 推算，config 的 odds 只是快照 */
    payout?: { rtp?: number; maxOdds?: number }
    /** 只有任選分頁會帶 */
    chosen?: Partial<Kl8Chosen>
  }
  tabGroup?: ConfigGroup[]
}
type ConfigPlay = { key?: string; name?: string; list?: ConfigTab[] }

const _plays = C_PLAYS as ConfigPlay[]

const _num = (value: unknown, fallback: number): number => {
  const num = Number(value)
  return Number.isFinite(num) && num >= 0 ? num : fallback
}

/** 取玩法設定（renxuan / liangmian） */
export function findKl8Play(playKey?: string): ConfigPlay | null {
  const key = String(playKey ?? '')
  if (!key) return null
  return _plays.find((play) => play.key === key) ?? null
}

/** 取分頁設定；tabId 給不出來時回該玩法第一個分頁 */
export function findKl8Tab(playKey?: string, tabId?: number | string): ConfigTab | null {
  const play = findKl8Play(playKey)
  if (!play?.list?.length) return null
  const id = Number(tabId)
  if (!Number.isFinite(id) || id <= 0) return play.list[0] ?? null
  return play.list.find((tab) => Number(tab.tabId) === id) ?? null
}

/** 以注項名稱（或 playId）找設定項（靜態注項：兩面四組） */
function _findTabItem(
  playKey?: string,
  tabId?: number | string,
  betCode?: string | number
): { group: ConfigGroup; item: ConfigOption } | null {
  const code = String(betCode ?? '').trim()
  if (!code) return null
  const groups = findKl8Tab(playKey, tabId)?.tabGroup
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

/**
 * 注項查找（兩段式）
 *
 * 1. 靜態注項：注碼就是注項名稱（或 playId）
 * 2. 任選：注碼是「分頁名 + 逗號分隔號碼」（`任三中三03,07,15`），
 *    設定檔只有 `任三中三` 這一項 → 以前綴比對認回去
 *    ⚠️ 前綴比對只在 `kl8KindOf(code) === 'renxuan'` 時才用，
 *       否則像「大單」這種注碼可能被別的注項名稱前綴誤吃。
 */
function _resolveItem(
  playKey?: string,
  tabId?: number | string,
  betCode?: string | number
): { group: ConfigGroup; item: ConfigOption } | null {
  const exact = _findTabItem(playKey, tabId, betCode)
  if (exact) return exact

  const code = String(betCode ?? '').trim()
  if (!code || kl8KindOf(code) !== 'renxuan') return null
  const groups = findKl8Tab(playKey, tabId)?.tabGroup
  for (const group of Array.isArray(groups) ? groups : []) {
    const list = Array.isArray(group?.groupList) ? group.groupList : []
    const item = list.find((option) => {
      const name = String(option?.name ?? '')
      return name.length > 0 && code.startsWith(name)
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
      const found = _resolveItem(play.key, tab.tabId, code)
      if (found) return { playKey: String(play.key ?? ''), tabId: Number(tab.tabId ?? 0), item: found.item }
    }
  }
  return null
}

/** 取分頁的投注限額 */
export function kl8QuotaOf(playKey?: string, tabId?: number | string): Kl8Quota {
  const quota = findKl8Tab(playKey, tabId)?.settings?.quota
  return {
    item: {
      min: _num(quota?.item?.min, KL8_QUOTA_FALLBACK.item.min),
      max: _num(quota?.item?.max, KL8_QUOTA_FALLBACK.item.max)
    },
    issue: { max: _num(quota?.issue?.max, KL8_QUOTA_FALLBACK.issue.max) }
  }
}

/**
 * 取任選分頁的選號張數限制
 * @returns 設定值；非任選分頁（沒有 chosen 設定）回 null，呼叫端可據此判斷是不是複式玩法
 */
export function kl8ChosenOf(playKey?: string, tabId?: number | string): Kl8Chosen | null {
  const chosen = findKl8Tab(playKey, tabId)?.settings?.chosen
  if (!chosen) return null
  const pick = _num(chosen.pick, 0)
  if (!(pick > 0)) return null
  return {
    pick,
    min: _num(chosen.min, pick),
    max: Math.max(_num(chosen.max, pick), pick)
  }
}

/** 取分頁設定的回報率 */
export function kl8RtpOf(playKey?: string, tabId?: number | string): number {
  const rtp = Number(findKl8Tab(playKey, tabId)?.settings?.payout?.rtp)
  return Number.isFinite(rtp) && rtp > 0 ? rtp : KL8_RTP_FALLBACK
}

/** 取分頁設定的賠率上限（未設定回 0 表示不封頂） */
export function kl8MaxOddsOf(playKey?: string, tabId?: number | string): number {
  const maxOdds = Number(findKl8Tab(playKey, tabId)?.settings?.payout?.maxOdds)
  return Number.isFinite(maxOdds) && maxOdds > 0 ? maxOdds : 0
}

/**
 * 取注項賠率（含本金）
 *
 * 一律由 kl8-cd.ts 依「公平賠率 × 該分頁 rtp」推算，而不是讀 config 的 odds ——
 * config 的 odds 只是產生時的快照，改 rtp 就會與實際不符。
 * ⚠️ 用**注碼本身**推賠率（不是注項名稱）—— 任選的注碼帶號碼、名稱不帶，
 *    拿名稱去算會得到 0。靜態注項的注碼與名稱相同，兩者等價。
 * @returns 賠率；注項不在該分頁或注碼無法辨識回 0
 */
export function kl8TabOddsOf(playKey?: string, tabId?: number | string, betCode?: string | number): number {
  const found = _resolveItem(playKey, tabId, betCode)
  if (!found) return 0
  const odds = kl8OddsOf(String(betCode ?? ''), kl8RtpOf(playKey, tabId))
  if (!(odds > 0)) return 0
  const maxOdds = kl8MaxOddsOf(playKey, tabId)
  return maxOdds > 0 ? Math.min(odds, maxOdds) : odds
}

/**
 * 該注項是否存在於指定分頁（伺端驗證用）
 *
 * ⚠️ 「注項存在」對任選還不夠 —— 號碼個數／範圍／重複只有判定層驗得出來
 *    （`任三中三03,03,07` 也會前綴命中 `任三中三`），所以併驗 `kl8ChanceOf`。
 */
export function kl8HasBetCode(playKey?: string, tabId?: number | string, betCode?: string | number): boolean {
  if (_resolveItem(playKey, tabId, betCode) === null) return false
  return kl8ChanceOf(String(betCode ?? '')) !== null
}

/** 依 playId／name／任選前綴找到注項所在的 playKey/tabId（伺端結算只存得到 betCode 時用） */
export function kl8FindPlayLocation(betCode?: string | number): { playKey: string; tabId: number } | null {
  const found = _findAnyTabItem(betCode)
  return found ? { playKey: found.playKey, tabId: found.tabId } : null
}

/**
 * 取注項的爆池分配權重
 *
 * 順序：注項 weight → 群組 weight → 0（不參與分配）
 * ⚠️ 明確給 0 代表「該注項排除在爆池外」，與「沒設定」（呼叫端會退回
 *    KL8_JACKPOT_SETTINGS.weightFallback）是兩件不同的事，故用 null 判斷而非 falsy。
 * @returns 權重；注項不在該分頁或無法辨識回 0
 */
export function kl8JackpotWeightOf(playKey?: string, tabId?: number | string, betCode?: string | number): number {
  const found = _resolveItem(playKey, tabId, betCode)
  if (!found) return 0
  const itemWeight = found.item.weight == null ? null : Number(found.item.weight)
  if (itemWeight != null && Number.isFinite(itemWeight) && itemWeight >= 0) return itemWeight
  const groupWeight = found.group.weight == null ? null : Number(found.group.weight)
  if (groupWeight != null && Number.isFinite(groupWeight) && groupWeight >= 0) return groupWeight
  return 0
}
