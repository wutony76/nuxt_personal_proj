import type { OpenCodeRecord } from './lotteryBase'
import { K3_DICE_COUNT, K3_DICE_MAX } from '#shared/config/k3-cd'

/**
 * 快3 的共用狀態：K3-CD 與 K3-OF 共用「當日期表（開獎號）」與「彩池」
 *
 * ── 為什麼需要這一層 ────────────────────────────────────
 * LOTTERY_BASE 的 recordOpenCode 是 instance 欄位，且 prdOpenCode() 會
 * `this.recordOpenCode = []` 重建陣列 —— 兩個 class 各自跑就會產生兩份不同的開獎號
 * （6HC 目前就是這樣：LHC-CD 與 LHC-OF 的同一期開出的號碼其實不一樣）。
 *
 * 這裡把期表收在 module 級單例，兩個 class 覆寫 prdOpenCode 後改為：
 *   先跑到的那個產生當日期表 → 後跑到的直接拿到「同一個陣列參照」
 * 因此 refreshCurrent / currentInfo 等 base 的邏輯完全不用改，
 * 兩邊讀到的期別、開獎號、倒數都必然一致。
 *
 * ⚠️ 期表是「以日期為單位」重建。跨日時兩個 class 都會呼叫 prdOpenCode，
 *    但只有第一個會真的重新產生（dateKey 比對），第二個直接沿用。
 */

export type K3SharedPool = {
  /** 展示用池底（每次重設由 owner 決定，兩邊看到同一個值） */
  base: number
  baseSetAt: number
  /** 累積滾存（未派出的獎金滾到下期） */
  carry: number
  /** 各期抽水累積：issue → 金額（CD 與 OF 的抽水都進同一個池） */
  issueMap: Record<string, number>
}

type K3SharedState = {
  /** 期表所屬日期（YYYYMMDD），用來判斷是否需要重建 */
  dateKey: string
  /** 當日期表（含開獎號）—— 兩個 class 的 recordOpenCode 都指向這個陣列 */
  recordOpenCode: OpenCodeRecord[]
  pool: K3SharedPool
}

export const K3_SHARED: K3SharedState = {
  dateKey: '',
  recordOpenCode: [],
  pool: { base: 0, baseSetAt: 0, carry: 0, issueMap: {} }
}

/** 快3 開獎：3 顆骰子，每顆 1 ~ 6（可重複，與 6HC 的不重複取球不同） */
export function k3RandomOpenCode(): string[] {
  return Array.from({ length: K3_DICE_COUNT }, () => String(Math.floor(Math.random() * K3_DICE_MAX) + 1))
}

/**
 * 確保當日期表已產生，並回傳「共用的那個陣列參照」
 *
 * @param dateKey 當日 key（YYYYMMDD），由呼叫端用 timer.formatDateKey 算好
 * @param build   產生當日期表的函式（由呼叫端提供，沿用 base 的期別／時間計算）
 * @returns 共用期表（呼叫端應直接把它賦值給 this.recordOpenCode，不要再 copy）
 */
export function k3EnsureDraw(dateKey: string, build: () => OpenCodeRecord[]): OpenCodeRecord[] {
  const key = String(dateKey ?? '')
  // 已經是今天的期表就直接沿用，後進來的 class 不會覆蓋掉先產生的開獎號
  if (K3_SHARED.dateKey === key && K3_SHARED.recordOpenCode.length > 0) {
    return K3_SHARED.recordOpenCode
  }
  K3_SHARED.dateKey = key
  K3_SHARED.recordOpenCode = build()
  // 跨日重建期表時，各期抽水紀錄一併清掉（carry 保留，滾存跨日繼續）
  K3_SHARED.pool.issueMap = {}
  return K3_SHARED.recordOpenCode
}

/** 累加某期的抽水（CD 與 OF 都往同一個池加） */
export function k3AddIssuePool(issue: string, amount: number): void {
  const key = String(issue ?? '')
  const add = Number(amount)
  if (!key || !Number.isFinite(add) || add <= 0) return
  K3_SHARED.pool.issueMap[key] = Number((Number(K3_SHARED.pool.issueMap[key] ?? 0) + add).toFixed(2))
}

/** 取某期已累積的抽水 */
export function k3IssuePool(issue: string): number {
  return Number(K3_SHARED.pool.issueMap[String(issue ?? '')] ?? 0)
}

/** 可發放獎金 = 該期抽水 + 累積滾存 */
export function k3DistributablePool(issue: string): number {
  return Number((k3IssuePool(issue) + K3_SHARED.pool.carry).toFixed(2))
}
