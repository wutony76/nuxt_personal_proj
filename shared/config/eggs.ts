/**
 * PC蛋蛋（EGGS）的基本運算（遊戲層，只有信用盤一個盤口）
 *
 * 開獎為 3 顆球、每顆 0 ~ 9 且可重複，共 10³ = 1,000 種等機率結果 —— 全部可窮舉，機率是精確值。
 * 開獎結構與本專案 `shared/config/ssc.ts` 的「前中後三」完全相同（三球、每球 0~9），
 * 牌型判定（豹子／对子／顺子）沿用該檔既有慣例，但獨立實作於本檔，
 * 避免 eggs 家族反向依賴 ssc 家族（兩個彩種各自的核心不應互相 import）。
 *
 * ── 與 k3 / ssc 的分工一致 ──────────────────────────────
 *   本檔                          球號那一層的對應物：號碼運算 + 機率
 *   shared/config/eggs-cd.ts      信用盤：注碼判定包裝 + 賠率推導
 *   shared/config/eggscd/         看板設定（注項、限額），由 helpers 讀取
 *
 * ── 來源與規則依據 ───────────────────────────────────────
 *   玩法名稱／分類／playId：bglottery `pceggs/config_play.js`
 *   大小門檻（>13 大）：bglottery `pceggs/header.vue` genClass 邏輯
 *   色波對照表：bglottery `pceggs/dict.js`
 *   极大/极小門檻：所有可查來源均未定義，已由使用者於提案階段確認（見 design.md）
 *   豹子/对子/顺子：沿用 `shared/config/ssc.ts` 既有的三球牌型判定慣例
 */

/** 一期開幾顆球 */
export const EGGS_BALL_COUNT = 3
/** 每顆球的最大值（0 ~ 9） */
export const EGGS_DIGIT_MAX = 9
/** 全部可能結果數（10³） */
export const EGGS_TOTAL_OUTCOMES = (EGGS_DIGIT_MAX + 1) ** EGGS_BALL_COUNT
/** 和值範圍（3 個 0 ~ 3 個 9） */
export const EGGS_SUM_MIN = 0
export const EGGS_SUM_MAX = EGGS_DIGIT_MAX * EGGS_BALL_COUNT

/** 大小分界：和值 > 13 為大、≤ 13 為小（來源：bglottery header.vue genClass） */
export const EGGS_BIG_LINE = 13

/** 极大/极小門檻（含頭尾）；使用者確認、非原始碼依據，見 design.md */
export const EGGS_EXTREME_BIG_RANGE = [22, 27] as const
export const EGGS_EXTREME_SMALL_RANGE = [0, 5] as const

/** 色波對照表（來源：bglottery pceggs/dict.js）；灰色 4 個和值目前無對應可下注玩法 */
export const EGGS_WAVE_MAP: Record<'紅波' | '藍波' | '綠波' | '灰', number[]> = {
  紅波: [3, 6, 9, 12, 15, 18, 21, 24],
  藍波: [2, 5, 8, 11, 17, 20, 23, 26],
  綠波: [1, 4, 7, 10, 16, 19, 22, 25],
  灰: [0, 13, 14, 27]
}

/** 三球牌型（豹子／对子／顺子；其餘組合對這三個特殊玩法而言皆不中） */
export type EggsPattern = '豹子' | '對子' | '順子' | null

/** 把開獎號正規化成 3 顆球；格式不合回 null */
export function eggsDigitsOf(openCode: Array<string | number>): number[] | null {
  const raw = Array.isArray(openCode) ? openCode : []
  if (raw.length !== EGGS_BALL_COUNT) return null
  const digits = raw.map((code) => Number(code))
  if (digits.some((num) => !Number.isInteger(num) || num < 0 || num > EGGS_DIGIT_MAX)) return null
  return digits
}

/** 和值（3 顆球相加，0 ~ 27） */
export function eggsSumOf(digits: number[]): number {
  return digits.reduce((acc, cur) => acc + cur, 0)
}

/**
 * 三球牌型判定
 *
 * ⚠️ 順子的定義：三個號碼互不相同且可排成連號，**不含**跨 9→0 的環狀連號
 *    （890、901 不算順子）—— 與 `shared/config/ssc.ts` 的 `sscTriplePatternOf` 同一套規則，
 *    改規則要一併調整 `eggsPatternCounts()` 的對帳測試。
 */
export function eggsPatternOf(triple: number[]): EggsPattern {
  const nums = (Array.isArray(triple) ? triple : []).map((n) => Number(n))
  if (nums.length !== 3 || nums.some((n) => !Number.isInteger(n) || n < 0 || n > EGGS_DIGIT_MAX)) return null
  const uniq = new Set(nums)
  if (uniq.size === 1) return '豹子'
  if (uniq.size === 2) return '對子'
  const sorted = [...nums].sort((a, b) => a - b) as [number, number, number]
  if (sorted[1] === sorted[0] + 1 && sorted[2] === sorted[1] + 1) return '順子'
  return null
}

// ── 窮舉快取 ────────────────────────────────────────────────────────────────

const _memo = new Map<string, unknown>()
function _cached<T>(key: string, build: () => T): T {
  if (!_memo.has(key)) _memo.set(key, build())
  return _memo.get(key) as T
}

/** 全部 1,000 種開獎結果 */
export function eggsAllOutcomes(): number[][] {
  return _cached('outcomes', () => {
    const list: number[][] = []
    for (let a = 0; a <= EGGS_DIGIT_MAX; a++) {
      for (let b = 0; b <= EGGS_DIGIT_MAX; b++) {
        for (let c = 0; c <= EGGS_DIGIT_MAX; c++) list.push([a, b, c])
      }
    }
    return list
  })
}

/** 各和值的結果數（0 ~ 27，合計 1,000） */
export const EGGS_SUM_COUNTS: Record<number, number> = (() => {
  const table: Record<number, number> = {}
  for (let a = 0; a <= EGGS_DIGIT_MAX; a++) {
    for (let b = 0; b <= EGGS_DIGIT_MAX; b++) {
      for (let c = 0; c <= EGGS_DIGIT_MAX; c++) {
        const sum = a + b + c
        table[sum] = (table[sum] ?? 0) + 1
      }
    }
  }
  return table
})()

/** 各三球牌型的組合數（豹子/对子/顺子；未列入的組合＝半順/雜六，對這三個玩法都不中） */
export function eggsPatternCounts(): Record<'豹子' | '對子' | '順子', number> {
  return _cached('patternCounts', () => {
    const table = { 豹子: 0, 對子: 0, 順子: 0 } as Record<'豹子' | '對子' | '順子', number>
    eggsAllOutcomes().forEach((triple) => {
      const pattern = eggsPatternOf(triple)
      if (pattern) table[pattern] += 1
    })
    return table
  })
}
