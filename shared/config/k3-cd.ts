/**
 * 快3（K3）判定與賠率核心
 *
 * 開獎為 3 顆骰子、每顆 1 ~ 6，共 6³ = 216 種等機率結果。
 * 所有機率都能窮舉驗證，因此本檔的賠率一律由「公平賠率 × RTP」推導，不寫死拍板數字：
 *   公平賠率 = 216 / 該注項命中的結果數
 *
 * ── 與 6hc-cd 的分工一致 ────────────────────────────────
 *   本檔（shared/config/k3-cd.ts）  ：判定邏輯與賠率推導，不讀設定檔
 *   shared/config/k3cd/*            ：看板設定（注項、限額、賠率），由 helpers 讀取
 *   ⚠️ 本檔不可 import k3cd/helpers —— helpers 會 import 本檔，會形成循環。
 *      需要設定值（rtp / odds）的判定一律由呼叫端傳入。
 *
 * ── 圍骰（三顆同點）對兩面的處理 ──────────────────────
 *   大小／單雙開出圍骰時判「和局」退還本金（與 6hc-cd 特碼兩面開 49 同一套語意），
 *   因此兩面的機率母數是 210（216 − 6 個圍骰）而非 216。
 */

import { type JackpotSettings } from '#shared/config/jackpot'
import {
  k3AllOutcomes,
  k3CountMap,
  k3DiceOf,
  k3IsTriple,
  k3SumOf,
  K3_DICE_COUNT,
  K3_DICE_MAX,
  K3_SUM_COUNTS,
  K3_SUM_MAX,
  K3_SUM_MIN,
  K3_TOTAL_OUTCOMES
} from '#shared/config/k3'

// 骰子基本運算收在 shared/config/k3.ts（兩個盤口共用），這裡轉出以便呼叫端只 import 一支
export {
  k3AllOutcomes,
  k3CountMap,
  k3DiceOf,
  k3IsTriple,
  k3SumOf,
  K3_DICE_COUNT,
  K3_DICE_MAX,
  K3_SUM_COUNTS,
  K3_SUM_MAX,
  K3_SUM_MIN,
  K3_TOTAL_OUTCOMES
}

/** 大小分界：和值 ≥ 11 為大、≤ 10 為小 */
export const K3_BIG_LINE = 11
/** 預設回報率（同 6hc-cd 的信用盤慣例） */
export const K3_RTP_FALLBACK = 0.97

export type K3BetKind = 'sum' | 'side' | 'single' | 'triple' | 'pair' | 'combo'
export type K3BetResult = 'win' | 'lose' | 'tie'

export type K3JudgeResult = {
  kind: K3BetKind
  result: K3BetResult
  /** 賠率（含本金） */
  odds: number
  /** 派彩金額（含本金）；和局退還本金、未中為 0 */
  payout: number
  /** 爆池權重（由設定檔帶入，未帶為 0） */
  weight?: number
}

/** 依 RTP 把公平賠率換成實際賠率（無條件捨去到小數 2 位，避免浮點多給） */
const _oddsOf = (hitCount: number, total: number, rtp: number): number => {
  if (!(hitCount > 0) || !(total > 0)) return 0
  const safeRtp = Number.isFinite(rtp) && rtp > 0 ? rtp : K3_RTP_FALLBACK
  return Math.floor((total / hitCount) * safeRtp * 100) / 100
}

const _payout = (kind: K3BetKind, result: K3BetResult, odds: number, coin: number): K3JudgeResult => {
  const amount = Number(coin)
  const safeCoin = Number.isFinite(amount) && amount > 0 ? amount : 0
  const payout = result === 'win'
    ? Number((safeCoin * odds).toFixed(2))
    : result === 'tie' ? safeCoin : 0
  return { kind, result, odds, payout }
}

// ── 各玩法的注項命中數（機率分子）────────────────────────

/** 和值：注項名稱為 "3" ~ "18" */
export function k3SumHitCount(sum: number): number {
  return K3_SUM_COUNTS[Number(sum)] ?? 0
}

/** 大小／單雙：母數 210（排除圍骰），各面命中 105 —— 由窮舉算出而非寫死 */
export function k3SideHitCount(name: string): number {
  const judge = K3_SIDE_JUDGES[String(name).trim()]
  if (!judge) return 0
  return k3AllOutcomes().filter((dice) => !k3IsTriple(dice) && judge(k3SumOf(dice))).length
}

/** 三軍（單骰）：該點數至少出現一次 = 216 − 5³ = 91 */
export function k3SingleHitCount(): number {
  return K3_TOTAL_OUTCOMES - (K3_DICE_MAX - 1) ** K3_DICE_COUNT
}

/** 圍骰指定（如「圍111」）：1 種 */
export function k3TripleHitCount(): number {
  return 1
}

/** 圍骰全（任意圍骰）：6 種 */
export function k3AnyTripleHitCount(): number {
  return K3_DICE_MAX
}

/** 對子（二同號包選，如「對11」）：恰兩顆同點、第三顆不同 = 3 × 5 = 15 種 */
export function k3PairHitCount(): number {
  return K3_DICE_COUNT * (K3_DICE_MAX - 1)
}

/** 二同號單選（如「11-2」：兩顆 1 加一顆 2）：3 種排列 */
export function k3PairExactHitCount(): number {
  return K3_DICE_COUNT
}

/**
 * 長牌（如「長12」）：指定的兩個不同點數都出現（第三顆任意）
 * 排容原理：|含a| + |含b| − |含a或b| = 91 + 91 − (216 − 4³) = 30
 */
export function k3LongHitCount(): number {
  const containsOne = K3_TOTAL_OUTCOMES - (K3_DICE_MAX - 1) ** K3_DICE_COUNT
  const containsEither = K3_TOTAL_OUTCOMES - (K3_DICE_MAX - 2) ** K3_DICE_COUNT
  return containsOne * 2 - containsEither
}

/** 三不同號標選（如「1-2-3」）：3! = 6 種排列 */
export function k3TripleDiffHitCount(): number {
  let permutations = 1
  for (let i = 2; i <= K3_DICE_COUNT; i++) permutations *= i
  return permutations
}

/** 三不同號全選（三顆點數互不相同）：6 × 5 × 4 = 120 種 */
export function k3AnyTripleDiffHitCount(): number {
  let count = 1
  for (let i = 0; i < K3_DICE_COUNT; i++) count *= K3_DICE_MAX - i
  return count
}

/** 兩面判定表（key 為注項名稱，值為「和值是否符合」）；圍骰另行判和局 */
const K3_SIDE_JUDGES: Record<string, (sum: number) => boolean> = {
  大: (sum) => sum >= K3_BIG_LINE,
  小: (sum) => sum < K3_BIG_LINE,
  單: (sum) => sum % 2 === 1,
  雙: (sum) => sum % 2 === 0,
}

/** 兩面注項名稱 */
export const K3_SIDE_NAMES = Object.keys(K3_SIDE_JUDGES)

// ── 注項名稱解析 ────────────────────────────────────────

/** 「圍111」→ 1；非圍骰指定回 0 */
const _parseTriple = (code: string): number => {
  const matched = /^圍([1-6])\1\1$/.exec(code)
  return matched ? Number(matched[1]) : 0
}
/** 「對11」→ 1；非對子回 0 */
const _parsePair = (code: string): number => {
  const matched = /^對([1-6])\1$/.exec(code)
  return matched ? Number(matched[1]) : 0
}
/** 「11-2」→ { pair: 1, single: 2 }；非二同號單選回 null */
const _parsePairExact = (code: string): { pair: number; single: number } | null => {
  const matched = /^([1-6])\1-([1-6])$/.exec(code)
  if (!matched) return null
  const pair = Number(matched[1])
  const single = Number(matched[2])
  return pair === single ? null : { pair, single }
}
/** 「長12」→ [1,2]（升冪、兩點不同）；非長牌回 null */
const _parseLong = (code: string): number[] | null => {
  const matched = /^長([1-6])([1-6])$/.exec(code)
  if (!matched) return null
  const a = Number(matched[1])
  const b = Number(matched[2])
  return a === b ? null : [a, b].sort((x, y) => x - y)
}

/** 「1-2-3」→ [1,2,3]（升冪、互不相同）；非三不同號標選回 null */
const _parseTripleDiff = (code: string): number[] | null => {
  if (!/^[1-6](-[1-6]){2}$/.test(code)) return null
  const nums = code.split('-').map((part) => Number(part))
  if (new Set(nums).size !== nums.length) return null
  return [...nums].sort((a, b) => a - b)
}

// ── 賠率查詢（不需開獎結果，供下注時鎖定與畫面顯示）──────

/**
 * 取注項賠率
 * @param betCode 注項名稱（"3" ~ "18"、"大"、"單"、"三軍1"、"圍111"、"圍骰全"、
 *                "對11"、"11-2"、"1-2-3"、"三不同全"）
 * @param rtp     該分頁的回報率（由設定檔帶入）
 * @returns 賠率（含本金）；無法辨識回 0
 */
export function k3OddsOf(betCode: string | number, rtp: number = K3_RTP_FALLBACK): number {
  const code = String(betCode ?? '').trim()
  if (!code) return 0

  // 和值
  if (/^\d+$/.test(code)) {
    const sum = Number(code)
    if (sum < K3_SUM_MIN || sum > K3_SUM_MAX) return 0
    return _oddsOf(k3SumHitCount(sum), K3_TOTAL_OUTCOMES, rtp)
  }
  // 大小單雙：母數排除圍骰（圍骰判和局，不列入輸贏）
  if (K3_SIDE_JUDGES[code]) {
    const total = K3_TOTAL_OUTCOMES - K3_DICE_MAX
    return _oddsOf(k3SideHitCount(code), total, rtp)
  }
  // 三軍（單骰）
  if (/^三軍[1-6]$/.test(code)) return _oddsOf(k3SingleHitCount(), K3_TOTAL_OUTCOMES, rtp)
  // 圍骰全
  if (code === '圍骰全') return _oddsOf(k3AnyTripleHitCount(), K3_TOTAL_OUTCOMES, rtp)
  // 圍骰指定
  if (_parseTriple(code) > 0) return _oddsOf(k3TripleHitCount(), K3_TOTAL_OUTCOMES, rtp)
  // 對子（二同號包選）
  if (_parsePair(code) > 0) return _oddsOf(k3PairHitCount(), K3_TOTAL_OUTCOMES, rtp)
  // 三不同號全選
  if (code === '三不同全') return _oddsOf(k3AnyTripleDiffHitCount(), K3_TOTAL_OUTCOMES, rtp)
  // 長牌（兩個指定點數都出現）
  if (_parseLong(code)) return _oddsOf(k3LongHitCount(), K3_TOTAL_OUTCOMES, rtp)
  // 二同號單選
  if (_parsePairExact(code)) return _oddsOf(k3PairExactHitCount(), K3_TOTAL_OUTCOMES, rtp)
  // 三不同號標選
  if (_parseTripleDiff(code)) return _oddsOf(k3TripleDiffHitCount(), K3_TOTAL_OUTCOMES, rtp)
  return 0
}

// ── 判定 ────────────────────────────────────────────────

/**
 * 快3 中獎判定
 * @param betCode  注項名稱（同 k3OddsOf）
 * @param openCode 該期開獎（3 顆骰子）
 * @param coin     注金
 * @param odds     下注時鎖定的賠率；未帶（或 ≤ 0）則以 rtp 即時推算
 * @param rtp      該分頁回報率
 * @returns 判定結果；注項無法辨識或開獎格式不合回 null
 */
export function judgeK3Bet(
  betCode: string | number,
  openCode: Array<string | number>,
  coin: number,
  odds: number = 0,
  rtp: number = K3_RTP_FALLBACK
): K3JudgeResult | null {
  const dice = k3DiceOf(openCode)
  if (!dice) return null
  const code = String(betCode ?? '').trim()
  if (!code) return null

  const lockedOdds = Number(odds) > 0 ? Number(odds) : k3OddsOf(code, rtp)
  if (!(lockedOdds > 0)) return null

  const sum = k3SumOf(dice)
  const isTriple = k3IsTriple(dice)
  const counts = k3CountMap(dice)

  // 和值
  if (/^\d+$/.test(code)) {
    const target = Number(code)
    if (target < K3_SUM_MIN || target > K3_SUM_MAX) return null
    return _payout('sum', sum === target ? 'win' : 'lose', lockedOdds, coin)
  }

  // 大小單雙：開圍骰一律和局退本金
  const sideJudge = K3_SIDE_JUDGES[code]
  if (sideJudge) {
    if (isTriple) return _payout('side', 'tie', lockedOdds, coin)
    return _payout('side', sideJudge(sum) ? 'win' : 'lose', lockedOdds, coin)
  }

  // 三軍（單骰）：該點數至少出現一次
  const singleMatched = /^三軍([1-6])$/.exec(code)
  if (singleMatched) {
    const target = Number(singleMatched[1])
    return _payout('single', (counts.get(target) ?? 0) > 0 ? 'win' : 'lose', lockedOdds, coin)
  }

  // 圍骰全
  if (code === '圍骰全') return _payout('triple', isTriple ? 'win' : 'lose', lockedOdds, coin)

  // 圍骰指定
  const triplePoint = _parseTriple(code)
  if (triplePoint > 0) {
    return _payout('triple', isTriple && dice[0] === triplePoint ? 'win' : 'lose', lockedOdds, coin)
  }

  // 對子（二同號包選）：恰兩顆該點數（圍骰不算）
  const pairPoint = _parsePair(code)
  if (pairPoint > 0) {
    return _payout('pair', counts.get(pairPoint) === 2 ? 'win' : 'lose', lockedOdds, coin)
  }

  // 三不同號全選
  if (code === '三不同全') {
    return _payout('combo', counts.size === K3_DICE_COUNT ? 'win' : 'lose', lockedOdds, coin)
  }

  // 長牌：指定的兩個點數都出現（第三顆任意）
  const long = _parseLong(code)
  if (long) {
    const hit = long.every((point) => (counts.get(point) ?? 0) > 0)
    return _payout('combo', hit ? 'win' : 'lose', lockedOdds, coin)
  }

  // 二同號單選：兩顆 pair + 一顆 single
  const pairExact = _parsePairExact(code)
  if (pairExact) {
    const hit = counts.get(pairExact.pair) === 2 && counts.get(pairExact.single) === 1
    return _payout('pair', hit ? 'win' : 'lose', lockedOdds, coin)
  }

  // 三不同號標選：三顆恰為指定的三個點數
  const tripleDiff = _parseTripleDiff(code)
  if (tripleDiff) {
    const sorted = [...dice].sort((a, b) => a - b)
    const hit = sorted.every((num, idx) => num === tripleDiff[idx])
    return _payout('combo', hit ? 'win' : 'lose', lockedOdds, coin)
  }

  return null
}

// ── 爆池（信用盤專屬，與官方盤的共用彩池是兩個獨立的池） ──────────

/**
 * 快3 信用盤的爆池設定
 *
 * ── 爆池期怎麼定 ────────────────────────────────────────
 *   開出**圍骰**（三顆同點）時觸發。選這個條件的理由與 ssc-cd 相同：
 *     1. 它是看板上真的存在的注項（圍骰／全骰分頁），玩家看得到也押得到
 *     2. 機率 6/216 ≒ 2.78%，與 6hc-cd 的「特別號開 49」（1/49 ≒ 2.04%）同一個量級
 *   ⚠️ 圍骰同時也是大小／單雙的和局號 —— 和局注單一樣算「有份」，
 *      與 6hc-cd「特碼兩面開 49 退本金但參與分配」是同一套語意。
 *
 * ⚠️ rakeRatio 是**另外**再撥一份進信用盤自己的爆池，
 *    與原本進 k3Shared 共用彩池（官方盤分層在吃）的抽水不互相吃。
 */
export const K3_CD_JACKPOT: JackpotSettings = {
  rakeRatio: 0.01,
  payoutRatio: 0.5,
  minPool: 1000,
  weightFallback: 1,
  hitLabel: '開出圍骰（三顆同點）',
  hitRate: 6 / 216
}

/**
 * 這一期是不是爆池期
 * @returns true = 圍骰；開獎格式不合回 false
 */
export function k3CdJackpotHit(openCode: Array<string | number>): boolean {
  const dice = k3DiceOf(openCode)
  if (!dice) return false
  return k3IsTriple(dice)
}

/** 爆池期的開獎文字（寫進爆池紀錄，給看板顯示用） */
export function k3CdJackpotLabel(openCode: Array<string | number>): string {
  const dice = k3DiceOf(openCode)
  if (!dice) return ''
  return `圍${dice.join('')}`
}

/** 玩法定義（供前端玩法列表與伺端註冊對帳） */
/** 玩法定義（順序即前端玩法列的顯示順序，需與 k3cd/plays.ts 一致） */
export const K3_PLAY_DEFINITIONS: Array<{ key: string; name: string }> = [
  { key: 'sanjun', name: '三軍/大小/點數' },
  { key: 'weitou', name: '圍骰/全骰' },
  { key: 'changduan', name: '長牌/短牌' }
]
