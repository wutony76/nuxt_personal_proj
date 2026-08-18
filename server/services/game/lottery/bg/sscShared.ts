import LOTTERY_BASE, { type OpenCodeRecord } from './base'
import { SSC_BALL_COUNT, SSC_DIGIT_MAX } from '#shared/config/ssc'

/**
 * 時時彩的共用狀態：SSC-CD 與 SSC-OF 共用「當日期表（開獎號）」與「彩池」
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
 * ⚠️ 本檔與 k3Shared.ts / pk10Shared.ts 是三份獨立狀態 —— 各彩種不共用期表也不共用彩池。
 */

export type SscSharedPool = {
  /** 展示用池底（每次重設由 owner 決定，兩邊看到同一個值） */
  base: number
  baseSetAt: number
  /** 累積滾存（未派出的獎金滾到下期） */
  carry: number
  /** 各期抽水累積：issue → 金額（CD 與 OF 的抽水都進同一個池） */
  issueMap: Record<string, number>
}

type SscSharedState = {
  /** 期表所屬日期（YYYYMMDD），用來判斷是否需要重建 */
  dateKey: string
  /** 當日期表（含開獎號）—— 兩個 class 的 recordOpenCode 都指向這個陣列 */
  recordOpenCode: OpenCodeRecord[]
  pool: SscSharedPool
}

export const SSC_SHARED: SscSharedState = {
  dateKey: '',
  recordOpenCode: [],
  pool: { base: 0, baseSetAt: 0, carry: 0, issueMap: {} }
}

/**
 * 池底（與 6hc / k3 / pk10 同一個概念）
 *
 * 只靠抽水養池，開站初期總獎金會是個位數。這裡補一個隨機池底，
 * 可發放獎金用與 6hc-of 相同的公式 LOTTERY_BASE.jackpotCalc()：
 *   (池底 + 該期抽水 × 0.8 + 滾存) × 0.55
 *
 * ⚠️ 時時彩兩個盤口**都是固定賠率**（官方盤沒有 pk10 前三直選那種彩池分層玩法），
 *    所以這個池純粹是看板的「總獎金」門面數字，不會真的被派彩吃掉，carry 也永遠是 0。
 *    留著是為了讓四個彩種的 poolState() 形狀一致，前端不必為 SSC 開特例。
 * ⚠️ 池底每期都會重新參與計算（同 6hc 的 jackpotBase），這是 demo 的設定，
 *    不是真實彩券的資金流。
 */
export const SSC_POOL_BASE_MIN = 120_000
export const SSC_POOL_BASE_MAX = 480_000

/**
 * 池底重骰門檻：可發放獎金低於此值就重骰
 *
 * k3 / pk10 是拿「頭獎最低保障 ÷ 頭獎分配比例」推的，時時彩沒有彩池分層玩法可推，
 * 故直接給一個門面數字的下限（低於這個值畫面上的總獎金會太寒酸）。
 */
export const SSC_POOL_FLOOR = 30_000

/**
 * 確保池底存在（沒有或已被吃到低於門檻就重骰）
 *
 * 兩個 class 的 poolState() 都會呼叫，先跑到的那個把池底設好，另一個直接沿用。
 * @returns 當前池底
 */
export function sscEnsurePoolBase(): number {
  const pool = SSC_SHARED.pool
  const distributable = sscDistributablePool(SSC_SHARED.recordOpenCode[0]?.issue ?? '')
  if (pool.base > 0 && distributable >= SSC_POOL_FLOOR) return pool.base
  pool.base = LOTTERY_BASE.jackpotBase(SSC_POOL_BASE_MIN, SSC_POOL_BASE_MAX)
  pool.baseSetAt = Date.now()
  return pool.base
}

/**
 * 時時彩開獎：5 個號碼、每個 0 ~ 9
 *
 * ⚠️ 號碼**可以重複**（與 pk10 的名次排列不同，比較接近快3 的骰子），
 *    所以是各自獨立取值，不能用洗牌。
 */
export function sscRandomOpenCode(): string[] {
  return Array.from({ length: SSC_BALL_COUNT }, () => String(Math.floor(Math.random() * (SSC_DIGIT_MAX + 1))))
}

/**
 * 確保當日期表已產生，並回傳「共用的那個陣列參照」
 *
 * @param dateKey 當日 key（YYYYMMDD），由呼叫端用 timer.formatDateKey 算好
 * @param build   產生當日期表的函式（由呼叫端提供，沿用 base 的期別／時間計算）
 * @returns 共用期表（呼叫端應直接把它賦值給 this.recordOpenCode，不要再 copy）
 */
export function sscEnsureDraw(dateKey: string, build: () => OpenCodeRecord[]): OpenCodeRecord[] {
  const key = String(dateKey ?? '')
  // 已經是今天的期表就直接沿用，後進來的 class 不會覆蓋掉先產生的開獎號
  if (SSC_SHARED.dateKey === key && SSC_SHARED.recordOpenCode.length > 0) {
    return SSC_SHARED.recordOpenCode
  }
  SSC_SHARED.dateKey = key
  SSC_SHARED.recordOpenCode = build()
  // 跨日重建期表時，各期抽水紀錄一併清掉（carry 保留，滾存跨日繼續）
  SSC_SHARED.pool.issueMap = {}
  return SSC_SHARED.recordOpenCode
}

/** 累加某期的抽水（CD 與 OF 都往同一個池加） */
export function sscAddIssuePool(issue: string, amount: number): void {
  const key = String(issue ?? '')
  const add = Number(amount)
  if (!key || !Number.isFinite(add) || add <= 0) return
  SSC_SHARED.pool.issueMap[key] = Number((Number(SSC_SHARED.pool.issueMap[key] ?? 0) + add).toFixed(2))
}

/** 取某期已累積的抽水 */
export function sscIssuePool(issue: string): number {
  return Number(SSC_SHARED.pool.issueMap[String(issue ?? '')] ?? 0)
}

/**
 * 可發放獎金 =（池底 + 該期抽水 × 0.8 + 累積滾存）× 0.55
 *
 * 與 6hc-of / k3 / pk10 同一條公式（LOTTERY_BASE.jackpotCalc），差別只在池底範圍。
 * ⚠️ 時時彩沒有吃池的玩法，這個值只給看板顯示用。
 */
export function sscDistributablePool(issue: string): number {
  return Number(
    LOTTERY_BASE.jackpotCalc(SSC_SHARED.pool.base, sscIssuePool(issue), SSC_SHARED.pool.carry).toFixed(2)
  )
}
