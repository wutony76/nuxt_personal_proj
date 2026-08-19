/**
 * 快3 官方盤的「賠率制」玩法（K3-OF）
 *
 * 玩法結構參照 pcv2_0223 的 app/config/bg/conf_k3_og.js：
 *   和值 / 三同號 / 三不同號 / 三連號 / 二同號 / 二不同號
 * 文案改繁體。與 k3-of.ts 既有的「選 3 個點數 → 獎池分層」是兩套並存的派彩方式：
 *   本檔這 6 個玩法走固定賠率，那一個玩法走共用彩池分層（相當於頭獎玩法）。
 *
 * ── 賠率怎麼來 ──────────────────────────────────────────
 *   216 種開獎結果可窮舉，所以機率是精確值，不是估的。
 *   賠率 = 公平賠率（母數 ÷ 命中數）× 該分頁 rtp，與 k3-cd.ts 同一套做法。
 *   ⚠️ 大小單雙的母數是 210 而不是 216 —— 圍骰（三顆同點）在兩面判定裡算和局，
 *      6 種圍骰結果要從母數扣掉，否則賠率會偏低。
 *
 * ── 注碼格式 ────────────────────────────────────────────
 *   和值      和3 ~ 和18、大、小、單、雙
 *   三同號    三同通選、三同1 ~ 三同6（三同1 即 111）
 *   三不同號  三不同123（三個遞增數字）
 *   三連號    三連通選
 *   二同號    二同複1 ~ 二同複6（對子 + 第三顆任意不同）
 *             二同1-2（對子 1 + 指定不同號 2）
 *   二不同號  二不同12（兩個遞增數字）
 *   ⚠️ 判定一律看注碼字串，不看 config 的 odds（那只是產生時的快照）。
 *
 * ⚠️ 本檔不可 import k3of/helpers.ts（helpers 會 import 本檔，會形成循環）。
 */
import { k3AllOutcomes, k3DiceOf, k3IsTriple, k3SumOf, K3_DICE_MAX, K3_TOTAL_OUTCOMES } from '#shared/config/k3'

/** 兩面（大小單雙）的母數：扣掉 6 種圍骰（和局） */
export const K3OF_TWO_SIDE_TOTAL = K3_TOTAL_OUTCOMES - K3_DICE_MAX
/** 大小分界：和值 ≥ 11 為大 */
export const K3OF_BIG_LINE = 11
/** 取不到分頁 rtp 時的預設回報率 */
export const K3OF_RTP_FALLBACK = 0.97

/** 三連號通選的三組連號（不含 456 以外的環狀組合） */
export const K3OF_RUNS: readonly (readonly number[])[] = [[1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5, 6]]

/** 判定結果：和局（tie）不派彩也不算輸，退回本金 */
export type K3OfBetResult = { status: 'win' | 'lose' | 'tie'; odds: number; payout: number }

const _int = (value: unknown): number => {
  const num = Number(value)
  return Number.isInteger(num) ? num : NaN
}
const _isPoint = (num: number): boolean => Number.isInteger(num) && num >= 1 && num <= K3_DICE_MAX
/** 該點數在開獎結果中出現幾次 */
const _countOf = (dice: number[], point: number): number => dice.filter((num) => num === point).length

// ── 注碼解析 ────────────────────────────────────────────────────────────────
/** 和值 N */
const _parseSum = (code: string): number | null => {
  const matched = /^和(\d{1,2})$/.exec(code)
  if (!matched) return null
  const sum = _int(matched[1])
  return sum >= 3 && sum <= K3_DICE_MAX * 3 ? sum : null
}
/** 三同號單選：三同N */
const _parseTriple = (code: string): number | null => {
  const matched = /^三同([1-6])$/.exec(code)
  return matched ? _int(matched[1]) : null
}
/** 三不同號：三不同abc（三個遞增且互不相同的點數） */
const _parseThreeDiff = (code: string): number[] | null => {
  const matched = /^三不同([1-6])([1-6])([1-6])$/.exec(code)
  if (!matched) return null
  const nums = [_int(matched[1]), _int(matched[2]), _int(matched[3])]
  if (nums.some((num) => !_isPoint(num))) return null
  // 必須遞增（避免同一組合有多種寫法）且互不相同
  if (!(nums[0]! < nums[1]! && nums[1]! < nums[2]!)) return null
  return nums as number[]
}
/** 二同號複選：二同複N（該對子恰好出現兩顆，第三顆任意不同） */
const _parsePairAny = (code: string): number | null => {
  const matched = /^二同複([1-6])$/.exec(code)
  return matched ? _int(matched[1]) : null
}
/** 二同號單選：二同P-O（對子 P + 指定不同號 O） */
const _parsePairExact = (code: string): { pair: number; other: number } | null => {
  const matched = /^二同([1-6])-([1-6])$/.exec(code)
  if (!matched) return null
  const pair = _int(matched[1])
  const other = _int(matched[2])
  if (!_isPoint(pair) || !_isPoint(other) || pair === other) return null
  return { pair, other }
}
/** 二不同號：二不同ab（兩個遞增且不同的點數） */
const _parseTwoDiff = (code: string): number[] | null => {
  const matched = /^二不同([1-6])([1-6])$/.exec(code)
  if (!matched) return null
  const nums = [_int(matched[1]), _int(matched[2])]
  if (nums.some((num) => !_isPoint(num))) return null
  if (!(nums[0]! < nums[1]!)) return null
  return nums as number[]
}

/**
 * 注碼是否命中（判定的唯一入口，賠率與結算都靠它）
 * @returns true 命中／false 未命中／null 注碼無法辨識
 */
export function k3OfIsHit(betCode: string, openCode: Array<string | number>): boolean | null {
  const dice = k3DiceOf(openCode)
  if (!dice) return null
  const code = String(betCode ?? '').trim()
  if (!code) return null
  const sum = k3SumOf(dice)
  const triple = k3IsTriple(dice)
  const distinct = new Set(dice).size

  // ── 和值 ──
  const sumCode = _parseSum(code)
  if (sumCode !== null) return sum === sumCode
  // ── 兩面：圍骰為和局，這裡先回 false，和局由 judge 另外判 ──
  if (code === '大') return !triple && sum >= K3OF_BIG_LINE
  if (code === '小') return !triple && sum < K3OF_BIG_LINE
  if (code === '單') return !triple && sum % 2 === 1
  if (code === '雙') return !triple && sum % 2 === 0

  // ── 三同號 ──
  if (code === '三同通選') return triple
  const tripleCode = _parseTriple(code)
  if (tripleCode !== null) return triple && dice[0] === tripleCode

  // ── 三不同號：指定 3 個不同號恰為開獎的 3 顆 ──
  const threeDiff = _parseThreeDiff(code)
  if (threeDiff) return distinct === 3 && threeDiff.every((num) => dice.includes(num))

  // ── 三連號通選：三顆不同且構成連號 ──
  if (code === '三連通選') {
    return distinct === 3 && K3OF_RUNS.some((run) => run.every((num) => dice.includes(num)))
  }

  // ── 二同號 ──
  const pairAny = _parsePairAny(code)
  if (pairAny !== null) return _countOf(dice, pairAny) === 2
  const pairExact = _parsePairExact(code)
  if (pairExact) return _countOf(dice, pairExact.pair) === 2 && dice.includes(pairExact.other)

  // ── 二不同號：指定兩個不同號都出現（含其中一個成對的情況，同 k3-cd 的長牌） ──
  const twoDiff = _parseTwoDiff(code)
  if (twoDiff) return twoDiff.every((num) => dice.includes(num))

  return null
}

/** 該注碼是否為兩面玩法（圍骰要判和局） */
export function k3OfIsTwoSide(betCode: string): boolean {
  return ['大', '小', '單', '雙'].includes(String(betCode ?? '').trim())
}

/**
 * 命中數（216 種結果窮舉）
 *
 * 兩面玩法的母數是 210（扣掉圍骰），其餘為 216 —— 由 k3OfTotalOf 決定。
 * @returns 命中的結果數；注碼無法辨識回 0
 */
export function k3OfHitCount(betCode: string): number {
  return k3AllOutcomes().filter((dice) => k3OfIsHit(betCode, dice) === true).length
}

/** 該注碼的機率母數：兩面扣掉圍骰（和局不算樣本），其餘 216 */
export function k3OfTotalOf(betCode: string): number {
  return k3OfIsTwoSide(betCode) ? K3OF_TWO_SIDE_TOTAL : K3_TOTAL_OUTCOMES
}

/**
 * 注碼賠率（含本金）＝ 公平賠率 × rtp
 * @returns 賠率，取到小數 2 位；注碼無法辨識或機率為 0 回 0
 */
export function k3OfOddsOf(betCode: string, rtp: number = K3OF_RTP_FALLBACK): number {
  const hit = k3OfHitCount(betCode)
  if (!(hit > 0)) return 0
  const fair = k3OfTotalOf(betCode) / hit
  const safeRtp = Number.isFinite(rtp) && rtp > 0 ? rtp : K3OF_RTP_FALLBACK
  return Number((fair * safeRtp).toFixed(2))
}

/**
 * 判定一注
 *
 * @param lockedOdds 下注時鎖進注單的賠率；> 0 就以它為準（避免改設定後回頭影響已成立的注單）
 */
export function judgeK3OfBet(
  betCode: string,
  openCode: Array<string | number>,
  coin = 1,
  lockedOdds = 0
): K3OfBetResult | null {
  const hit = k3OfIsHit(betCode, openCode)
  if (hit === null) return null
  const dice = k3DiceOf(openCode)
  if (!dice) return null

  const odds = lockedOdds > 0 ? Number(lockedOdds) : k3OfOddsOf(betCode)
  const bet = Math.max(0, Number(coin) || 0)

  // 兩面遇圍骰＝和局：退回本金
  if (k3OfIsTwoSide(betCode) && k3IsTriple(dice)) {
    return { status: 'tie', odds, payout: Number(bet.toFixed(2)) }
  }
  if (!hit) return { status: 'lose', odds, payout: 0 }
  return { status: 'win', odds, payout: Number((bet * odds).toFixed(2)) }
}

// ── 組合玩法：把使用者選的點數展開成一注一注的注碼 ──────────────────────────
/**
 * 組合玩法的注碼展開
 *
 * 三不同號標準：選 n 個點數 → C(n,3) 注
 * 二不同號標準：選 n 個點數 → C(n,2) 注
 * 膽拖：膽碼必含，其餘從拖碼補滿 pick 個 → C(拖碼數, pick − 膽碼數) 注
 *
 * @param prefix 注碼前綴（三不同 / 二不同）
 * @param pick   一注幾個點數
 * @param nums   標準玩法選的點數
 * @param dan    膽碼（膽拖玩法用；給了就走膽拖）
 * @param tuo    拖碼
 */
export function k3OfComboCodes(options: {
  prefix: '三不同' | '二不同'
  pick: number
  nums?: number[]
  dan?: number[]
  tuo?: number[]
}): string[] {
  const { prefix, pick } = options
  const uniq = (list: number[] = []) => Array.from(new Set(list.filter(_isPoint))).sort((a, b) => a - b)
  const toCode = (combo: number[]) => `${prefix}${[...combo].sort((a, b) => a - b).join('')}`

  const combine = (pool: number[], size: number): number[][] => {
    if (size <= 0) return [[]]
    if (pool.length < size) return []
    const [head, ...rest] = pool
    if (head === undefined) return []
    return [
      ...combine(rest, size - 1).map((combo) => [head, ...combo]),
      ...combine(rest, size)
    ]
  }

  const dan = uniq(options.dan)
  if (dan.length > 0) {
    // 膽拖：膽碼不可超過 pick − 1（至少要有一個拖碼，否則就是標準玩法）
    if (dan.length >= pick) return []
    const tuo = uniq(options.tuo).filter((num) => !dan.includes(num))
    return combine(tuo, pick - dan.length).map((combo) => toCode([...dan, ...combo]))
  }
  return combine(uniq(options.nums), pick).map(toCode)
}
