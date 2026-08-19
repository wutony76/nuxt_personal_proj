import LOTTERY_BASE, { type OpenCodeRecord } from './base'
import {
  buildJackpotShares,
  type JackpotHitRecord,
  type JackpotResult,
  type JackpotRow
} from '#shared/config/jackpot'
import { X5_JACKPOT_SETTINGS } from '#shared/config/x5-cd'
import { x5NumberLabel, X5_BALL_COUNT, X5_NUMBERS } from '#shared/config/x5'

/**
 * 11選5 的共用狀態：X5-CD 與 X5-OF 共用「當日期表（開獎號）」與「彩池」
 *
 * ── 為什麼需要這一層 ────────────────────────────────────
 * LOTTERY_BASE 的 recordOpenCode 是 instance 欄位，且 prdOpenCode() 會
 * `this.recordOpenCode = []` 重建陣列 —— 兩個 class 各自跑就會產生兩份不同的開獎號
 * （6HC 目前就是這樣：LHC-CD 與 LHC-OF 的同一期開出的號碼其實不一樣）。
 *
 * 這裡把期表收在 module 級單例，兩個 class 覆寫 prdOpenCode 後改為：
 *   先跑到的那個產生當日期表 → 後跑到的直接拿到「同一個陣列參照」
 * 因此 refreshCurrent / currentInfo 等 base 的邏輯完全不用改。
 *
 * ⚠️ 階段 1 只有信用盤（X5-CD）接上，但期表與彩池照收在本檔 ——
 *    期別與開獎號本來就該是兩盤口共用的單一真相，階段 2 接官方盤時
 *    不必回頭改已驗證過的信用盤結算路徑。
 * ⚠️ 本檔與 sscShared.ts / k3Shared.ts / pk10Shared.ts 是各自獨立的狀態，
 *    各彩種不共用期表也不共用彩池。
 */

export type X5SharedPool = {
  /** 展示用池底（每次重設由 owner 決定，兩邊看到同一個值） */
  base: number
  baseSetAt: number
  /** 累積滾存（未派出的獎金滾到下期） */
  carry: number
  /** 各期抽水累積：issue → 金額（CD 與 OF 的抽水都進同一個池） */
  issueMap: Record<string, number>
}

type X5SharedState = {
  /** 期表所屬日期（YYYYMMDD），用來判斷是否需要重建 */
  dateKey: string
  /** 當日期表（含開獎號）—— 兩個 class 的 recordOpenCode 都指向這個陣列 */
  recordOpenCode: OpenCodeRecord[]
  pool: X5SharedPool
}

export const X5_SHARED: X5SharedState = {
  dateKey: '',
  recordOpenCode: [],
  pool: { base: 0, baseSetAt: 0, carry: 0, issueMap: {} }
}

/**
 * 池底（與 6hc / k3 / pk10 / ssc 同一個概念）
 *
 * 只靠抽水養池，開站初期總獎金會是個位數。這裡補一個隨機池底，
 * 可發放獎金用與 6hc-of 相同的公式 LOTTERY_BASE.jackpotCalc()：
 *   (池底 + 該期抽水 × 0.8 + 滾存) × 0.55
 *
 * ⚠️ 這個池是**官方盤直選類**未來要吃的（階段 2）；信用盤是固定賠率，
 *    只負責抽水養池。階段 1 因此只會看到池額累積、還不會有人從這裡領走。
 * ⚠️ 信用盤的「爆池」是**另一個獨立的池**（見本檔下半 X5_JACKPOT），
 *    不與本節的共用彩池互相吃 —— 否則兩條結算路會搶同一個 carry。
 */
export const X5_POOL_BASE_MIN = 120_000
export const X5_POOL_BASE_MAX = 480_000

/**
 * 池底重骰門檻：可發放獎金低到連頭獎的最低保障都撐不起來時重骰
 *
 * ⚠️ 階段 1 為 0（＝只在還沒有池底時骰一次）——
 *    門檻要由官方盤的分層設定（階段 2 的 `X5_OF_PRIZE_TIERS` 頭獎最低保障 ÷ 分配比例）推出來，
 *    在官方盤還不存在時寫任何數字都是憑空假設。階段 2 接上官方盤時改成
 *    比照 sscShared.ts 的 `SSC_POOL_FLOOR` 由 tier 推導。
 */
export const X5_POOL_FLOOR = 0

/**
 * 確保池底存在（沒有或已被吃到低於門檻就重骰）
 * @returns 當前池底
 */
export function x5EnsurePoolBase(): number {
  const pool = X5_SHARED.pool
  const distributable = x5DistributablePool(X5_SHARED.recordOpenCode[0]?.issue ?? '')
  if (pool.base > 0 && distributable >= X5_POOL_FLOOR) return pool.base
  pool.base = LOTTERY_BASE.jackpotBase(X5_POOL_BASE_MIN, X5_POOL_BASE_MAX)
  pool.baseSetAt = Date.now()
  return pool.base
}

/**
 * 11選5 開獎：從 1 ~ 11 取 5 個**不重複**號碼，有位置（第一 ~ 第五球）
 *
 * ⚠️ 號碼**不可重複**（與 ssc 的各自獨立取值不同，比較接近 pk10 的名次排列），
 *    所以用洗牌取前 5 個，不能各自 random。
 * ⚠️ 回傳補零兩位的字串（'01' ~ '11'）—— 11選5 的顯示慣例；
 *    判定端一律 Number() 收斂，所以不影響比對。
 */
export function x5RandomOpenCode(): string[] {
  const pool = [...X5_NUMBERS]
  // Fisher-Yates：只需要前 X5_BALL_COUNT 個
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = pool[i] as number
    pool[i] = pool[j] as number
    pool[j] = tmp
  }
  return pool.slice(0, X5_BALL_COUNT).map((num) => x5NumberLabel(num))
}

/**
 * 確保當日期表已產生，並回傳「共用的那個陣列參照」
 *
 * @param dateKey 當日 key（YYYYMMDD），由呼叫端用 timer.formatDateKey 算好
 * @param build   產生當日期表的函式（由呼叫端提供，沿用 base 的期別／時間計算）
 * @returns 共用期表（呼叫端應直接把它賦值給 this.recordOpenCode，不要再 copy）
 */
export function x5EnsureDraw(dateKey: string, build: () => OpenCodeRecord[]): OpenCodeRecord[] {
  const key = String(dateKey ?? '')
  // 已經是今天的期表就直接沿用，後進來的 class 不會覆蓋掉先產生的開獎號
  if (X5_SHARED.dateKey === key && X5_SHARED.recordOpenCode.length > 0) {
    return X5_SHARED.recordOpenCode
  }
  X5_SHARED.dateKey = key
  X5_SHARED.recordOpenCode = build()
  // 跨日重建期表時，各期抽水紀錄一併清掉（carry 保留，滾存跨日繼續）
  X5_SHARED.pool.issueMap = {}
  return X5_SHARED.recordOpenCode
}

/** 累加某期的抽水（CD 與 OF 都往同一個池加） */
export function x5AddIssuePool(issue: string, amount: number): void {
  const key = String(issue ?? '')
  const add = Number(amount)
  if (!key || !Number.isFinite(add) || add <= 0) return
  X5_SHARED.pool.issueMap[key] = Number((Number(X5_SHARED.pool.issueMap[key] ?? 0) + add).toFixed(2))
}

/** 取某期已累積的抽水 */
export function x5IssuePool(issue: string): number {
  return Number(X5_SHARED.pool.issueMap[String(issue ?? '')] ?? 0)
}

/**
 * 可發放獎金 =（池底 + 該期抽水 × 0.8 + 累積滾存）× 0.55
 * 與 6hc-of / k3 / pk10 / ssc 同一條公式（LOTTERY_BASE.jackpotCalc），差別只在池底範圍。
 */
export function x5DistributablePool(issue: string): number {
  return Number(
    LOTTERY_BASE.jackpotCalc(X5_SHARED.pool.base, x5IssuePool(issue), X5_SHARED.pool.carry).toFixed(2)
  )
}

// ── 爆池（兩個盤口共吃同一池） ───────────────────────────────────────────────

/**
 * 11選5 爆池的共用狀態
 *
 * ── 為什麼收在共用層 ────────────────────────────────────
 *   兩個盤口共吃一池，狀態必須放在兩個 class 都看得到的地方，而且**只能結算一次** ——
 *   兩個 class 的 circle() 是同一個 tick 依序跑的（見 server/plugins/init.ts），
 *   各自都會對同一期呼叫 settleIssuePrize。
 *
 * ── 怎麼保證只結算一次、又能等到兩邊的注單 ────────────────
 *   `submitRows` 讓每個盤口在自己的結算流程裡「交件」（自己判定自己的注單），
 *   等到**所有已註冊的盤口都交件**才真的計算分配（`settleIfReady`）。
 *   因此誰先跑到都無所謂，不依賴 Storage.games 的註冊順序。
 *   ⚠️ 階段 1 只有 'cd' 註冊，所以信用盤一交件就會立刻分配；
 *      階段 2 註冊 'of' 後自動變成「等兩份」，本檔不需要改。
 *
 * ── 為什麼要讓各盤口自己寫回 ────────────────────────────
 *   分配結果要寫回 `jackpotAmount` 與可領金額，但信用盤的注單在 `user.x5Record`、
 *   官方盤（階段 2）在 `user.x5OfRecord` —— 兩種 record 形狀不同。
 *   共用層不去理解那兩種形狀，各盤口靠 `JackpotShare.source` 挑自己那半處理。
 *
 * ⚠️ 與 X5_SHARED.pool 是**兩個不同的池**：那個是官方盤分層派彩用的，
 *    本節這個是爆池。兩者的 carry 分開記，不會互相吃。
 */

/** 盤口代號（同時是 JackpotRow.source 與 X5_JACKPOT_SETTINGS.boardWeight 的 key） */
export type X5JackpotBoard = 'cd' | 'of'

type X5JackpotState = {
  /** 各期爆池抽水累積：issue → 金額 */
  issueMap: Record<string, number>
  /** 未發放的滾存 */
  carry: number
  /** 最近一次爆池紀錄 */
  lastHit: JackpotHitRecord | null
  /** 已結算過的期別（保證一期只分配一次） */
  settledMap: Record<string, boolean>
  /** 各盤口交件的注單：issue → board → rows */
  pending: Record<string, Partial<Record<X5JackpotBoard, JackpotRow[]>>>
  /** 該期的分配結果（兩個盤口各自取用自己那半） */
  results: Record<string, JackpotResult>
}

export const X5_JACKPOT: X5JackpotState = {
  issueMap: {},
  carry: 0,
  lastHit: null,
  settledMap: {},
  pending: {},
  results: {}
}

/** 已註冊的盤口（class 在 constructor 註冊；決定「要等幾份交件」） */
const _boards = new Set<X5JackpotBoard>()

/**
 * 註冊一個盤口會參與爆池
 * ⚠️ 註冊了就一定要在自己的結算流程裡 submitRows，否則該期永遠湊不齊、不會發放。
 */
export function x5RegisterJackpotBoard(board: X5JackpotBoard): void {
  _boards.add(board)
}

/** 累加某期的爆池抽水（兩個盤口都往同一個池加） */
export function x5AddIssueJackpot(issue: string, amount: number): void {
  const key = String(issue ?? '')
  const add = Number(amount)
  if (!key || !Number.isFinite(add) || add <= 0) return
  X5_JACKPOT.issueMap[key] = Number((Number(X5_JACKPOT.issueMap[key] ?? 0) + add).toFixed(2))
}

/** 可發放爆池 = 該期抽水 + 累積滾存 */
export function x5JackpotPool(issue: string): number {
  const key = String(issue ?? '')
  return Number((Number(X5_JACKPOT.issueMap[key] ?? 0) + Number(X5_JACKPOT.carry ?? 0)).toFixed(2))
}

/** 某盤口交件：把自己判定好的注單列交給共用層 */
export function x5SubmitJackpotRows(issue: string, board: X5JackpotBoard, rows: JackpotRow[]): void {
  const key = String(issue ?? '')
  if (!key) return
  if (!X5_JACKPOT.pending[key]) X5_JACKPOT.pending[key] = {}
  X5_JACKPOT.pending[key][board] = Array.isArray(rows) ? rows : []
}

/**
 * 所有註冊的盤口都交件後才真的計算分配
 *
 * @param triggered 這一期是不是爆池期（由呼叫端用 x5JackpotHit() 判定）
 * @param openLabel 爆池期的開獎文字（寫進紀錄）
 * @returns 該期的分配結果；還沒湊齊回 null。**重複呼叫會回同一份結果**（不會重算）
 */
export function x5SettleJackpotIfReady(
  issue: string,
  triggered: boolean,
  openLabel: string
): JackpotResult | null {
  const key = String(issue ?? '')
  if (!key) return null
  if (X5_JACKPOT.settledMap[key]) return X5_JACKPOT.results[key] ?? null

  const pending = X5_JACKPOT.pending[key] ?? {}
  // 等所有註冊的盤口都交件；少一份就先不發，等下一個 class 跑到
  for (const board of _boards) {
    if (!Array.isArray(pending[board])) return null
  }

  const rows = Array.from(_boards).flatMap((board) => pending[board] ?? [])
  const pool = x5JackpotPool(key)
  const result = buildJackpotShares(rows, triggered, pool, X5_JACKPOT_SETTINGS)

  // 未發放的部分（含未觸發時的整池）滾存至下期
  X5_JACKPOT.carry = Number(result.remain.toFixed(2))
  X5_JACKPOT.issueMap[key] = 0
  X5_JACKPOT.settledMap[key] = true
  X5_JACKPOT.results[key] = result
  delete X5_JACKPOT.pending[key]
  if (result.triggered) {
    X5_JACKPOT.lastHit = {
      issue: key,
      openLabel: String(openLabel ?? ''),
      pool: result.pool,
      payout: result.payout,
      winners: new Set(result.shares.map((share) => share.userId)).size,
      orders: result.shares.length,
      createdAt: Date.now()
    }
  }
  return result
}

/**
 * 取某期已算好的分配結果（給「後跑到的那個 class」拿自己那半用）
 * @returns 尚未結算回 null
 */
export function x5JackpotResultOf(issue: string): JackpotResult | null {
  return X5_JACKPOT.results[String(issue ?? '')] ?? null
}

/** 爆池狀態（兩個盤口的 /jackpot 路由回同一份） */
export function x5JackpotState(issue: string) {
  const key = String(issue ?? '')
  return {
    issue: key,
    currentIssueJackpot: Number(X5_JACKPOT.issueMap[key] ?? 0),
    carryJackpot: Number(X5_JACKPOT.carry ?? 0),
    distributable: x5JackpotPool(key),
    rakeRatio: X5_JACKPOT_SETTINGS.rakeRatio,
    payoutRatio: X5_JACKPOT_SETTINGS.payoutRatio,
    minPool: X5_JACKPOT_SETTINGS.minPool,
    hitLabel: X5_JACKPOT_SETTINGS.hitLabel,
    hitRate: X5_JACKPOT_SETTINGS.hitRate,
    lastHit: X5_JACKPOT.lastHit
  }
}
