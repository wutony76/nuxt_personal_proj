import C_PLAYS from '#shared/config/cd/plays'
import { creditOddsOf, CREDIT_JACKPOT, type CreditBetKind } from '#shared/config/6hc-cd'

/**
 * 信用盤看板設定（c_tema / c_zhengma）的讀取層
 * 賠率與限額都以「分頁（tabId）設定」為主，取不到才退回全域預設，
 * 前端顯示 / clamp、伺端驗證 / 派彩全部走這裡，避免各自解析 config。
 */

export type CreditQuota = {
  /** 單注投注額 */
  item: { min: number; max: number }
  /** 單期投注額（同一玩家、同一期、同一分頁累計；max = 0 視為不限） */
  issue: { max: number }
}

/** 分頁未設定 quota 時的預設值 */
export const CREDIT_QUOTA_FALLBACK: CreditQuota = {
  item: { min: 1, max: 99999 },
  issue: { max: 0 },
}

type ConfigOption = { playId?: string | number; name?: string | number; odds?: number; weight?: number }
type ConfigGroup = { groupName?: string; groupList?: ConfigOption[]; weight?: number }
type ConfigTab = {
  tabId?: number
  tabName?: string
  settings?: { quota?: Partial<CreditQuota> }
  tabGroup?: ConfigGroup[]
}
type ConfigPlay = { key?: string; name?: string; list?: ConfigTab[] }

const _plays = C_PLAYS as ConfigPlay[]

const _num = (value: unknown, fallback: number): number => {
  const num = Number(value)
  return Number.isFinite(num) && num >= 0 ? num : fallback
}

/** 取玩法設定（tema / zhengma…） */
export function findCreditPlay(playKey?: string): ConfigPlay | null {
  const key = String(playKey ?? '')
  if (!key) return null
  return _plays.find((play) => play.key === key) ?? null
}

/** 取分頁設定；tabId 給不出來時回該玩法第一個分頁 */
export function findCreditTab(playKey?: string, tabId?: number | string): ConfigTab | null {
  const play = findCreditPlay(playKey)
  if (!play?.list?.length) return null
  const id = Number(tabId)
  if (!Number.isFinite(id) || id <= 0) return play.list[0] ?? null
  return play.list.find((tab) => Number(tab.tabId) === id) ?? null
}

/** 取分頁限額（缺項逐欄退回 CREDIT_QUOTA_FALLBACK） */
export function creditQuotaOf(playKey?: string, tabId?: number | string): CreditQuota {
  const quota = findCreditTab(playKey, tabId)?.settings?.quota
  const min = _num(quota?.item?.min, CREDIT_QUOTA_FALLBACK.item.min)
  const max = _num(quota?.item?.max, CREDIT_QUOTA_FALLBACK.item.max)
  return {
    // min 大於 max 視為設定錯誤，以 max 為準避免整個分頁無法下注
    item: { min: Math.min(min, max), max },
    issue: { max: _num(quota?.issue?.max, CREDIT_QUOTA_FALLBACK.issue.max) },
  }
}

/**
 * 在分頁設定中找出注項所在的群組與該注項本身
 * @param betCode 注項名稱（"07" / "總和大"）或 playId（"3001-101"）
 */
function _findTabItem(
  playKey?: string,
  tabId?: number | string,
  betCode?: string | number
): { group: ConfigGroup; item: ConfigOption } | null {
  const code = String(betCode ?? '').trim()
  if (!code) return null
  const groups = findCreditTab(playKey, tabId)?.tabGroup
  for (const group of Array.isArray(groups) ? groups : []) {
    const list = Array.isArray(group?.groupList) ? group.groupList : []
    const item = list.find((option) => {
      if (String(option?.playId ?? '') === code) return true
      const name = String(option?.name ?? '')
      // 號碼可能未補零（"7" vs "07"），數字型注項改比數值
      if (/^\d+$/.test(name) && /^\d+$/.test(code)) return Number(name) === Number(code)
      return name === code
    })
    if (item) return { group, item }
  }
  return null
}

/**
 * 取單一注項賠率：以 config 分頁設定的 odds 為主（A/B 盤可不同），
 * 取不到才退回 shared/config/6hc-cd 的玩法賠率常數。
 * @param betCode 注項名稱（"07" / "總和大"）或 playId（"3001-101"）
 */
export function creditTabOddsOf(playKey?: string, tabId?: number | string, betCode?: string | number): number {
  const code = String(betCode ?? '').trim()
  if (!code) return 0
  const odds = Number(_findTabItem(playKey, tabId, code)?.item?.odds)
  if (Number.isFinite(odds) && odds > 0) return odds
  return creditOddsOf(playKey, code)
}

/** 只有「設定檔真的寫了一個 ≥ 0 的數字」才算有設定；未寫 / 寫錯型別回 null 交給下一層 */
const _explicitWeight = (value: unknown): number | null => {
  if (value == null) return null
  const num = Number(value)
  return Number.isFinite(num) && num >= 0 ? num : null
}

/**
 * 取單一注項的爆池分配權重
 * 順序：注項 weight（七碼逐項覆寫）→ 群組 weight → 全域 CREDIT_JACKPOT.weights[kind]
 * 設定值 0 視為「該注項不參與分配」，與「沒設定」不同 —— 沒設定才會往下一層退。
 * @param betCode 注項名稱或 playId
 * @param kind 判定結果的注項類別，僅在設定查不到時作為退回依據
 */
export function creditJackpotWeightOf(
  playKey?: string,
  tabId?: number | string,
  betCode?: string | number,
  kind?: CreditBetKind | null
): number {
  const found = _findTabItem(playKey, tabId, betCode)
  const itemWeight = _explicitWeight(found?.item?.weight)
  if (itemWeight !== null) return itemWeight
  const groupWeight = _explicitWeight(found?.group?.weight)
  if (groupWeight !== null) return groupWeight
  return kind ? Number(CREDIT_JACKPOT.weights[kind] ?? 0) : 0
}
