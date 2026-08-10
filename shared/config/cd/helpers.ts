import C_PLAYS from '#shared/config/cd/plays'
import {
  creditHexiaoOddsOf,
  creditLianweiOddsOf,
  creditLianxiaoOddsOf,
  creditOddsOf,
  creditTexiaoOddsOf,
  creditWeishuOddsOf,
  creditWuxingOddsOf,
  creditYixiaoOddsOf,
  CREDIT_JACKPOT,
  CREDIT_WUXING_RTP_FALLBACK,
  type CreditBetKind,
  type CreditLianmaTier,
  type CreditMatchMode
} from '#shared/config/6hc-cd'

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

/**
 * 連碼的選號規格：一注固定 pick 個號，玩家可選 minPick ~ maxPick 個號
 * 組成複式（C(已選, pick) 注）。只有連碼分頁會有這塊。
 */
export type CreditCombo = {
  /** 一注幾個號 */
  pick: number
  /** 至少要選幾個號才能組單 */
  minPick: number
  /** 最多可選幾個號（複式上限） */
  maxPick: number
}

type ConfigOption = {
  playId?: string | number
  name?: string | number
  odds?: number
  weight?: number
  /**
   * 該注項涵蓋的號碼（僅供看板／說明頁顯示，判定不讀這裡）
   * 半波由 banboNumsOf() 產生、五行由 wuxingNumsOf() 依當年產生，皆非寫死
   */
  nums?: string[]
}
type ConfigGroup = { groupName?: string; groupList?: ConfigOption[]; weight?: number }
type ConfigTab = {
  tabId?: number
  tabName?: string
  settings?: {
    quota?: Partial<CreditQuota>
    combo?: Partial<CreditCombo>
    /** 五行 / 一肖：賠率由號碼數推算，config 只設回報率 */
    payout?: { rtp?: number }
    /** 一肖：命中方向（hit = 開出即中、miss = 沒開出才中） */
    match?: CreditMatchMode
  }
  tabGroup?: ConfigGroup[]
  /** 連碼：命中檔次與賠率（取代 tabGroup 的逐項 odds） */
  tiers?: CreditLianmaTier[]
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
export function creditTabOddsOf(
  playKey?: string,
  tabId?: number | string,
  betCode?: string | number,
  year?: number,
  /** 合肖 / 連肖專用：賠率取決於「所選的那幾個生肖」，需帶完整號碼組才能推算；未帶則退回單一 betCode */
  betCodes?: Array<string | number>
): number {
  const code = String(betCode ?? '').trim()
  if (!code) return 0
  // 五行 / 一肖的號碼歸屬逐年輪轉，賠率不在 config 而是由該年的號碼數推算
  const safeYear = Number(year) || new Date().getFullYear()
  if (String(playKey ?? '') === 'wuxing') {
    return creditWuxingOddsOf(code, safeYear, creditRtpOf(playKey, tabId))
  }
  // ⚠️ 特肖與一肖的公式「不同」，不可共用分支：
  //    特肖只看特別號（rtp × 49 / 該生肖號碼數 → 11.88 / 9.51）
  //    一肖看 7 顆球（連肖 n = 1 的容斥機率 → 2.06 / 1.75），差 5 倍以上
  if (String(playKey ?? '') === 'texiao') {
    return creditTexiaoOddsOf(code, safeYear, creditMatchModeOf(playKey, tabId), creditRtpOf(playKey, tabId))
  }
  if (String(playKey ?? '') === 'yixiao') {
    return creditYixiaoOddsOf(code, safeYear, creditMatchModeOf(playKey, tabId), creditRtpOf(playKey, tabId))
  }
  // 合肖 / 連肖：注項是玩家自選的一組生肖，賠率隨組合變動，不能只看單一 betCode
  if (['hexiao', 'lianxiao'].includes(String(playKey ?? ''))) {
    const animals = (Array.isArray(betCodes) && betCodes.length > 0 ? betCodes : [betCode]).map((a) => String(a).trim())
    const mode = creditMatchModeOf(playKey, tabId)
    const rtp = creditRtpOf(playKey, tabId)
    return String(playKey) === 'hexiao'
      ? creditHexiaoOddsOf(animals, safeYear, mode, rtp)
      : creditLianxiaoOddsOf(animals, safeYear, mode, rtp)
  }
  // 尾數：號碼分布固定不隨年份變動，公式同一肖但不需要年份參數
  if (String(playKey ?? '') === 'weishu') {
    return creditWeishuOddsOf(code, creditMatchModeOf(playKey, tabId), creditRtpOf(playKey, tabId))
  }
  // 連尾：注項是玩家自選的一組尾數，賠率隨組合變動，不能只看單一 betCode（同合肖／連肖）
  if (String(playKey ?? '') === 'lianwei') {
    const tails = (Array.isArray(betCodes) && betCodes.length > 0 ? betCodes : [betCode]).map((a) => String(a).trim())
    return creditLianweiOddsOf(tails, creditMatchModeOf(playKey, tabId), creditRtpOf(playKey, tabId))
  }
  const odds = Number(_findTabItem(playKey, tabId, code)?.item?.odds)
  if (Number.isFinite(odds) && odds > 0) return odds
  return creditOddsOf(playKey, code, year)
}

/**
 * 取分頁的命中方向（一肖用）
 * hit = 開出即中（一肖中）、miss = 沒開出才中（一肖不中）；未設定一律當 hit
 */
export function creditMatchModeOf(playKey?: string, tabId?: number | string): CreditMatchMode {
  return findCreditTab(playKey, tabId)?.settings?.match === 'miss' ? 'miss' : 'hit'
}

/** 取分頁設定的回報率（五行 / 一肖用；未設定回 CREDIT_WUXING_RTP_FALLBACK） */
export function creditRtpOf(playKey?: string, tabId?: number | string): number {
  const rtp = Number(findCreditTab(playKey, tabId)?.settings?.payout?.rtp)
  return Number.isFinite(rtp) && rtp > 0 ? rtp : CREDIT_WUXING_RTP_FALLBACK
}

/**
 * 取分頁的連碼選號規格；非連碼分頁（沒有 combo 設定）回 null
 * 前端看板據此限制可選號碼數，伺端據此驗證每注的號碼數
 */
export function creditComboOf(playKey?: string, tabId?: number | string): CreditCombo | null {
  const combo = findCreditTab(playKey, tabId)?.settings?.combo
  const pick = Number(combo?.pick)
  if (!Number.isFinite(pick) || pick <= 0) return null
  const minPick = _num(combo?.minPick, pick)
  const maxPick = _num(combo?.maxPick, pick)
  return {
    pick,
    // 至少要能組出一注，且上限不得小於下限（設定寫反時以 pick 為底線）
    minPick: Math.max(pick, minPick),
    maxPick: Math.max(Math.max(pick, minPick), maxPick),
  }
}

/**
 * 取分頁的命中檔次表（連碼專用）；順序即判定優先序（高賠率在前）
 * 下注時整份快照到注單上，結算即以注單上的值派彩
 */
export function creditTiersOf(playKey?: string, tabId?: number | string): CreditLianmaTier[] {
  const tiers = findCreditTab(playKey, tabId)?.tiers
  return (Array.isArray(tiers) ? tiers : [])
    .filter((tier) => String(tier?.key ?? '') && Number(tier?.odds) > 0)
    .map((tier) => ({
      key: String(tier.key),
      name: String(tier.name ?? ''),
      odds: Number(tier.odds),
      weight: Number(tier.weight ?? 0),
    }))
}

/** 組合數 C(n, k)，供複式注數計算（前端預覽與伺端驗證共用） */
export function creditComboCount(n: number, k: number): number {
  const total = Math.trunc(Number(n) || 0)
  const pick = Math.trunc(Number(k) || 0)
  if (pick < 0 || pick > total) return 0
  let result = 1
  for (let i = 1; i <= pick; i++) result = (result * (total - pick + i)) / i
  return Math.round(result)
}

/** 只有「設定檔真的寫了一個 ≥ 0 的數字」才算有設定；未寫 / 寫錯型別回 null 交給下一層 */
const _explicitWeight = (value: unknown): number | null => {
  if (value == null) return null
  const num = Number(value)
  return Number.isFinite(num) && num >= 0 ? num : null
}

/**
 * 取單一注項的爆池分配權重
 * 順序：命中檔次 weight（連碼）→ 注項 weight（七碼逐項覆寫）→ 群組 weight
 *      → 全域 CREDIT_JACKPOT.weights[kind]
 * 設定值 0 視為「該注項不參與分配」，與「沒設定」不同 —— 沒設定才會往下一層退。
 * @param betCode 注項名稱或 playId
 * @param kind 判定結果的注項類別，僅在設定查不到時作為退回依據
 * @param tierKey 命中的檔次 key（連碼專用，權重掛在檔次上而非號碼上）
 */
export function creditJackpotWeightOf(
  playKey?: string,
  tabId?: number | string,
  betCode?: string | number,
  kind?: CreditBetKind | null,
  tierKey?: string | null
): number {
  if (tierKey) {
    const tier = findCreditTab(playKey, tabId)?.tiers?.find((item) => String(item?.key ?? '') === tierKey)
    const tierWeight = _explicitWeight(tier?.weight)
    if (tierWeight !== null) return tierWeight
  }
  const found = _findTabItem(playKey, tabId, betCode)
  const itemWeight = _explicitWeight(found?.item?.weight)
  if (itemWeight !== null) return itemWeight
  const groupWeight = _explicitWeight(found?.group?.weight)
  if (groupWeight !== null) return groupWeight
  return kind ? Number(CREDIT_JACKPOT.weights[kind] ?? 0) : 0
}
