import LOTTERY_BASE, { type OpenCodeRecord } from './base'
import { recordPoolReseed } from './poolAudit'
import {
  buildJackpotShares,
  type JackpotHitRecord,
  type JackpotResult,
  type JackpotRow
} from '#shared/config/jackpot'
import { K3_JACKPOT_SETTINGS, K3_DICE_COUNT, K3_DICE_MAX } from '#shared/config/k3-cd'
import { K3_OF_PRIZE_TIERS } from '#shared/config/k3-of'

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

/**
 * 池底（與 6hc 同一個概念）
 *
 * 只靠抽水養池，開站初期總獎金會是個位數（CD 抽 2%、OF 抽 60%）。這裡補一個隨機池底，
 * 可發放獎金改用與 6hc-of 相同的公式 LOTTERY_BASE.jackpotCalc()：
 *   (池底 + 該期抽水 × 0.8 + 滾存) × 0.55
 *
 * 範圍取到「可發放獎金落在 6 萬 ~ 25 萬」：池底 × 0.55 就是抽水為 0 時的可發放金額。
 * ⚠️ 池底每期都會重新參與計算（同 6hc 的 jackpotBase），等於莊家每期注入
 *    池底 × 0.55 的獎金 —— 這是 demo 的設定，不是真實彩券的資金流。
 */
export const K3_POOL_BASE_MIN = 110_000
export const K3_POOL_BASE_MAX = 450_000

/**
 * 池底重骰門檻：可發放獎金低到連頭獎的最低保障都撐不起來時重骰
 * 門檻＝頭獎最低保障 ÷ 頭獎分配比例（例如 20,000 ÷ 0.7 ≒ 28,572）
 */
const K3_TOP_TIER = K3_OF_PRIZE_TIERS.find((tier) => tier.type === 'pool' && tier.match === K3_DICE_COUNT)
export const K3_POOL_FLOOR = K3_TOP_TIER && K3_TOP_TIER.type === 'pool' && K3_TOP_TIER.minAmount
  ? Math.ceil(K3_TOP_TIER.minAmount / K3_TOP_TIER.ratio)
  : 0

/**
 * 確保池底存在（沒有或已被吃到低於門檻就重骰）
 *
 * 兩個 class 的 poolState() 都會呼叫，先跑到的那個把池底設好，另一個直接沿用。
 * @returns 當前池底
 */
export function k3EnsurePoolBase(): number {
  const pool = K3_SHARED.pool
  const issue = K3_SHARED.recordOpenCode[0]?.issue ?? ''
  const distributable = k3DistributablePool(issue)
  if (pool.base > 0 && distributable >= K3_POOL_FLOOR) return pool.base
  const before = distributable
  pool.base = LOTTERY_BASE.jackpotBase(K3_POOL_BASE_MIN, K3_POOL_BASE_MAX)
  pool.baseSetAt = Date.now()
  recordPoolReseed('K3', issue, before, pool.base)
  return pool.base
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

/**
 * 可發放獎金 =（池底 + 該期抽水 × 0.8 + 累積滾存）× 0.55
 *
 * 與 6hc-of 同一條公式（LOTTERY_BASE.jackpotCalc），差別只在池底範圍是快3 自己的。
 * ⚠️ 這個值同時是前端顯示的「總獎金」與官方盤分層派彩的母數 ——
 *    K3 刻意不像 6hc 分成「門面值」與「派彩值」兩條，顯示的就是真的發得出來的。
 */
export function k3DistributablePool(issue: string): number {
  return Number(
    LOTTERY_BASE.jackpotCalc(K3_SHARED.pool.base, k3IssuePool(issue), K3_SHARED.pool.carry).toFixed(2)
  )
}

// ── 爆池（兩個盤口共吃同一池） ───────────────────────────────────────────────

/**
 * 快3爆池的共用狀態
 *
 * ── 為什麼收在共用層 ────────────────────────────────────
 *   爆池原本掛在 K3_CD class 上，只有信用盤的注單分得到。改成兩盤共吃一池後，
 *   狀態必須放在兩個 class 都看得到的地方，而且**只能結算一次** ——
 *   兩個 class 的 circle() 是同一個 tick 依序跑的（見 server/plugins/init.ts），
 *   各自都會對同一期呼叫 settleIssuePrize。
 *
 * ── 怎麼保證只結算一次、又能等到兩邊的注單 ────────────────
 *   `submitRows` 讓每個盤口在自己的結算流程裡「交件」（自己判定自己的注單），
 *   等到**所有已註冊的盤口都交件**才真的計算分配（`settleIfReady`）。
 *   因此誰先跑到都無所謂，不依賴 Storage.games 的註冊順序。
 *
 * ── 為什麼要 apply 回呼 ──────────────────────────────────
 *   分配結果要寫回 `jackpotAmount` 與可領金額，但信用盤的注單在 `user.k3Record`、
 *   官方盤在 `user.k3OfRecord` —— 兩種 record 形狀不同。
 *   共用層不去理解那兩種形狀，改讓每個盤口註冊一個 apply，各自處理自己那半
 *   （靠 JackpotShare.source 分流）。
 *
 * ⚠️ 與 K3_SHARED.pool 是**兩個不同的池**：那個是官方盤分層派彩用的，
 *    本節這個是爆池。兩者的 carry 分開記，不會互相吃。
 */

/** 盤口代號（同時是 JackpotRow.source 與 K3_JACKPOT_SETTINGS.boardWeight 的 key） */
export type K3JackpotBoard = 'cd' | 'of'

type K3JackpotState = {
  /** 各期爆池抽水累積：issue → 金額 */
  issueMap: Record<string, number>
  /** 未發放的滾存 */
  carry: number
  /** 最近一次爆池紀錄 */
  lastHit: JackpotHitRecord | null
  /** 已結算過的期別（保證一期只分配一次） */
  settledMap: Record<string, boolean>
  /** 各盤口交件的注單：issue → board → rows */
  pending: Record<string, Partial<Record<K3JackpotBoard, JackpotRow[]>>>
  /** 該期的分配結果（兩個盤口各自取用自己那半） */
  results: Record<string, JackpotResult>
}

export const K3_JACKPOT: K3JackpotState = {
  issueMap: {},
  carry: 0,
  lastHit: null,
  settledMap: {},
  pending: {},
  results: {}
}

/**
 * 爆池開站種子池底（僅一次性 seed 到 carry，之後照既有機制自然演化，比照 EGGS/KL10/KL8/PL3
 * 的 `carryJackpot = LOTTERY_BASE.jackpotBase(...)` 寫法）
 * ⚠️ 範圍沿用 K3_POOL_BASE_MIN/MAX（共用彩池的既有池底範圍），只是套用在爆池這個獨立的池上，
 *    兩個池底互不影響、各自隨機。
 */
export const K3_JACKPOT_BASE_MIN = K3_POOL_BASE_MIN
export const K3_JACKPOT_BASE_MAX = K3_POOL_BASE_MAX
let _jackpotSeeded = false

/** 已註冊的盤口（class 在 constructor 註冊；決定「要等幾份交件」） */
const _boards = new Set<K3JackpotBoard>()

/**
 * 註冊一個盤口會參與爆池
 * ⚠️ 註冊了就一定要在自己的結算流程裡 submitRows，否則該期永遠湊不齊、不會發放。
 * ⚠️ 兩個盤口都會呼叫這支，種子池底只在第一次呼叫時灌一次（`_jackpotSeeded` 保證不重複），
 *    不管先註冊的是 cd 還是 of。
 */
export function k3RegisterJackpotBoard(board: K3JackpotBoard): void {
  _boards.add(board)
  if (_jackpotSeeded) return
  _jackpotSeeded = true
  K3_JACKPOT.carry = LOTTERY_BASE.jackpotBase(K3_JACKPOT_BASE_MIN, K3_JACKPOT_BASE_MAX)
}

/** 累加某期的爆池抽水（兩個盤口都往同一個池加） */
export function k3AddIssueJackpot(issue: string, amount: number): void {
  const key = String(issue ?? '')
  const add = Number(amount)
  if (!key || !Number.isFinite(add) || add <= 0) return
  K3_JACKPOT.issueMap[key] = Number((Number(K3_JACKPOT.issueMap[key] ?? 0) + add).toFixed(2))
}

/** 可發放爆池 = 該期抽水 + 累積滾存 */
export function k3JackpotPool(issue: string): number {
  const key = String(issue ?? '')
  return Number((Number(K3_JACKPOT.issueMap[key] ?? 0) + Number(K3_JACKPOT.carry ?? 0)).toFixed(2))
}

/** 某盤口交件：把自己判定好的注單列交給共用層 */
export function k3SubmitJackpotRows(issue: string, board: K3JackpotBoard, rows: JackpotRow[]): void {
  const key = String(issue ?? '')
  if (!key) return
  if (!K3_JACKPOT.pending[key]) K3_JACKPOT.pending[key] = {}
  K3_JACKPOT.pending[key][board] = Array.isArray(rows) ? rows : []
}

/**
 * 所有註冊的盤口都交件後才真的計算分配
 *
 * @param triggered 這一期是不是爆池期（由呼叫端用該彩種的 *JackpotHit() 判定）
 * @param openLabel 爆池期的開獎文字（寫進紀錄）
 * @returns 該期的分配結果；還沒湊齊回 null。**重複呼叫會回同一份結果**（不會重算）
 */
export function k3SettleJackpotIfReady(
  issue: string,
  triggered: boolean,
  openLabel: string
): JackpotResult | null {
  const key = String(issue ?? '')
  if (!key) return null
  if (K3_JACKPOT.settledMap[key]) return K3_JACKPOT.results[key] ?? null

  const pending = K3_JACKPOT.pending[key] ?? {}
  // 等所有註冊的盤口都交件；少一份就先不發，等下一個 class 跑到
  for (const board of _boards) {
    if (!Array.isArray(pending[board])) return null
  }

  const rows = Array.from(_boards).flatMap((board) => pending[board] ?? [])
  const pool = k3JackpotPool(key)
  const result = buildJackpotShares(rows, triggered, pool, K3_JACKPOT_SETTINGS)

  // 未發放的部分（含未觸發時的整池）滾存至下期
  K3_JACKPOT.carry = Number(result.remain.toFixed(2))
  K3_JACKPOT.issueMap[key] = 0
  K3_JACKPOT.settledMap[key] = true
  K3_JACKPOT.results[key] = result
  delete K3_JACKPOT.pending[key]
  if (result.triggered) {
    K3_JACKPOT.lastHit = {
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
export function k3JackpotResultOf(issue: string): JackpotResult | null {
  return K3_JACKPOT.results[String(issue ?? '')] ?? null
}

/** 爆池狀態（兩個盤口的 /jackpot 路由回同一份） */
export function k3JackpotState(issue: string) {
  const key = String(issue ?? '')
  return {
    issue: key,
    currentIssueJackpot: Number(K3_JACKPOT.issueMap[key] ?? 0),
    carryJackpot: Number(K3_JACKPOT.carry ?? 0),
    distributable: k3JackpotPool(key),
    rakeRatio: K3_JACKPOT_SETTINGS.rakeRatio,
    payoutRatio: K3_JACKPOT_SETTINGS.payoutRatio,
    minPool: K3_JACKPOT_SETTINGS.minPool,
    hitLabel: K3_JACKPOT_SETTINGS.hitLabel,
    hitRate: K3_JACKPOT_SETTINGS.hitRate,
    lastHit: K3_JACKPOT.lastHit
  }
}
