import LOTTERY_BASE, { type OpenCodeRecord } from './base'
import { PK10_CAR_COUNT, pk10CarCode } from '#shared/config/pk10'
import { PK10_OF_PRIZE_TIERS, PK10_OF_PICK_COUNT } from '#shared/config/pk10-of'

/**
 * PK10 的共用狀態：PK10-CD 與 PK10-OF 共用「當日期表（開獎號）」與「彩池」
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
 * ⚠️ 本檔與 k3Shared.ts 是兩份獨立狀態 —— 快3 與 PK10 不共用期表也不共用彩池。
 */

export type Pk10SharedPool = {
  /** 展示用池底（每次重設由 owner 決定，兩邊看到同一個值） */
  base: number
  baseSetAt: number
  /** 累積滾存（未派出的獎金滾到下期） */
  carry: number
  /** 各期抽水累積：issue → 金額（CD 與 OF 的抽水都進同一個池） */
  issueMap: Record<string, number>
}

type Pk10SharedState = {
  /** 期表所屬日期（YYYYMMDD），用來判斷是否需要重建 */
  dateKey: string
  /** 當日期表（含開獎號）—— 兩個 class 的 recordOpenCode 都指向這個陣列 */
  recordOpenCode: OpenCodeRecord[]
  pool: Pk10SharedPool
}

export const PK10_SHARED: Pk10SharedState = {
  dateKey: '',
  recordOpenCode: [],
  pool: { base: 0, baseSetAt: 0, carry: 0, issueMap: {} }
}

/**
 * 池底（與 6hc / k3 同一個概念）
 *
 * 只靠抽水養池，開站初期總獎金會是個位數（CD 抽 2%、OF 抽 60%）。這裡補一個隨機池底，
 * 可發放獎金用與 6hc-of 相同的公式 LOTTERY_BASE.jackpotCalc()：
 *   (池底 + 該期抽水 × 0.8 + 滾存) × 0.55
 *
 * ⚠️ 池底每期都會重新參與計算（同 6hc 的 jackpotBase），等於莊家每期注入
 *    池底 × 0.55 的獎金 —— 這是 demo 的設定，不是真實彩券的資金流。
 * ⚠️ 頭獎機率只有 1/720（快3 的頭獎是 1/56），中獎頻率低很多，
 *    因此池底範圍抓得比 k3 高一階，讓滾存累積時的畫面數字合理。
 */
export const PK10_POOL_BASE_MIN = 160_000
export const PK10_POOL_BASE_MAX = 600_000

/**
 * 池底重骰門檻：可發放獎金低到連頭獎的最低保障都撐不起來時重骰
 * 門檻＝頭獎最低保障 ÷ 頭獎分配比例（例如 20,000 ÷ 0.7 ≒ 28,572）
 */
const PK10_TOP_TIER = PK10_OF_PRIZE_TIERS.find(
  (tier) => tier.type === 'pool' && tier.match === PK10_OF_PICK_COUNT
)
export const PK10_POOL_FLOOR = PK10_TOP_TIER && PK10_TOP_TIER.type === 'pool' && PK10_TOP_TIER.minAmount
  ? Math.ceil(PK10_TOP_TIER.minAmount / PK10_TOP_TIER.ratio)
  : 0

/**
 * 確保池底存在（沒有或已被吃到低於門檻就重骰）
 *
 * 兩個 class 的 poolState() 都會呼叫，先跑到的那個把池底設好，另一個直接沿用。
 * @returns 當前池底
 */
export function pk10EnsurePoolBase(): number {
  const pool = PK10_SHARED.pool
  const distributable = pk10DistributablePool(PK10_SHARED.recordOpenCode[0]?.issue ?? '')
  if (pool.base > 0 && distributable >= PK10_POOL_FLOOR) return pool.base
  pool.base = LOTTERY_BASE.jackpotBase(PK10_POOL_BASE_MIN, PK10_POOL_BASE_MAX)
  pool.baseSetAt = Date.now()
  return pool.base
}

/**
 * PK10 開獎：10 台車跑完的名次表
 *
 * openCode[i] 是「第 i+1 名的車號」，整體必為 1 ~ 10 的一個排列
 * （不是快3 那種可重複取值，也不是 6hc 那種 49 取 7）。
 * 車號補零成兩位數，與注碼、前端球號顯示一致。
 */
export function pk10RandomOpenCode(): string[] {
  const cars = Array.from({ length: PK10_CAR_COUNT }, (_, idx) => idx + 1)
  // Fisher-Yates：等機率排列，避免 sort(() => Math.random() - 0.5) 的偏差
  for (let i = cars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = cars[i] as number
    cars[i] = cars[j] as number
    cars[j] = tmp
  }
  return cars.map((car) => pk10CarCode(car))
}

/**
 * 確保當日期表已產生，並回傳「共用的那個陣列參照」
 *
 * @param dateKey 當日 key（YYYYMMDD），由呼叫端用 timer.formatDateKey 算好
 * @param build   產生當日期表的函式（由呼叫端提供，沿用 base 的期別／時間計算）
 * @returns 共用期表（呼叫端應直接把它賦值給 this.recordOpenCode，不要再 copy）
 */
export function pk10EnsureDraw(dateKey: string, build: () => OpenCodeRecord[]): OpenCodeRecord[] {
  const key = String(dateKey ?? '')
  // 已經是今天的期表就直接沿用，後進來的 class 不會覆蓋掉先產生的開獎號
  if (PK10_SHARED.dateKey === key && PK10_SHARED.recordOpenCode.length > 0) {
    return PK10_SHARED.recordOpenCode
  }
  PK10_SHARED.dateKey = key
  PK10_SHARED.recordOpenCode = build()
  // 跨日重建期表時，各期抽水紀錄一併清掉（carry 保留，滾存跨日繼續）
  PK10_SHARED.pool.issueMap = {}
  return PK10_SHARED.recordOpenCode
}

/** 累加某期的抽水（CD 與 OF 都往同一個池加） */
export function pk10AddIssuePool(issue: string, amount: number): void {
  const key = String(issue ?? '')
  const add = Number(amount)
  if (!key || !Number.isFinite(add) || add <= 0) return
  PK10_SHARED.pool.issueMap[key] = Number((Number(PK10_SHARED.pool.issueMap[key] ?? 0) + add).toFixed(2))
}

/** 取某期已累積的抽水 */
export function pk10IssuePool(issue: string): number {
  return Number(PK10_SHARED.pool.issueMap[String(issue ?? '')] ?? 0)
}

/**
 * 可發放獎金 =（池底 + 該期抽水 × 0.8 + 累積滾存）× 0.55
 *
 * 與 6hc-of / k3 同一條公式（LOTTERY_BASE.jackpotCalc），差別只在池底範圍是 PK10 自己的。
 * ⚠️ 這個值同時是前端顯示的「總獎金」與官方盤分層派彩的母數 ——
 *    比照 k3 不分「門面值」與「派彩值」兩條，顯示的就是真的發得出來的。
 */
export function pk10DistributablePool(issue: string): number {
  return Number(
    LOTTERY_BASE.jackpotCalc(PK10_SHARED.pool.base, pk10IssuePool(issue), PK10_SHARED.pool.carry).toFixed(2)
  )
}
