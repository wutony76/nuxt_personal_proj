/**
 * 時時彩（SSC）的基本運算與注碼判定（遊戲層，兩個盤口共用）
 *
 * 開獎為 5 個號碼、每個 0 ~ 9 且可重複（萬/千/百/十/個位），
 * 共 10⁵ = 100,000 種等機率結果 —— 全部可窮舉，所以機率是精確值。
 *
 * ── 與 k3 / pk10 的分工一致 ──────────────────────────────
 *   本檔                      骰子／車號那一層的對應物：號碼運算 + 注碼判定 + 機率
 *   shared/config/ssc-cd.ts   信用盤：判定包裝 + 賠率推導
 *   shared/config/sscof.ts    官方盤：同上，rtp 預設值自己一份
 *   shared/config/ssccd|sscof 看板設定（注項、限額），由 helpers 讀取
 *
 * ── 為什麼機率用「取樣空間」而不是整體窮舉 ───────────────
 *   多數注項只看某幾個位置（單球 1/10、兩面 5/10、龍虎 100 組），
 *   直接算邊際分布即可；只有牌型類（前中後三、鬥牛、梭哈、總和）需要窮舉，
 *   那幾類分別是 1,000 / 100,000 種，算一次就快取起來（見 _memo）。
 *
 * ⚠️ 本檔不可 import 任何 helpers（helpers 會 import 本檔，會形成循環）。
 */

/** 一期開幾個號碼 */
export const SSC_BALL_COUNT = 5
/** 每個號碼的最大值（0 ~ 9） */
export const SSC_DIGIT_MAX = 9
/** 單球大小分界：號碼 ≥ 5 為大 */
export const SSC_BIG_LINE = 5
/** 總和範圍（5 個 0 ~ 5 個 9） */
export const SSC_SUM_MIN = 0
export const SSC_SUM_MAX = SSC_DIGIT_MAX * SSC_BALL_COUNT
/** 總和大小分界：總和 ≥ 23 為大（0~45 的中點切在 22/23） */
export const SSC_SUM_BIG_LINE = 23

/** 球位名稱（index 0 = 第一球 = 萬位） */
export const SSC_BALL_NAMES = ['第一球', '第二球', '第三球', '第四球', '第五球'] as const
/** 官方盤習慣用位數稱呼（萬/千/百/十/個），與球位一一對應 */
export const SSC_PLACE_NAMES = ['萬位', '千位', '百位', '十位', '個位'] as const

/** 三球牌型（前三／中三／後三共用） */
export type SscTriplePattern = '豹子' | '順子' | '對子' | '半順' | '雜六'
/** 三球區段 */
export const SSC_TRIPLE_SECTIONS = ['前三', '中三', '後三'] as const
export type SscTripleSection = (typeof SSC_TRIPLE_SECTIONS)[number]
/** 各區段取哪三個球位（0 起算） */
export const SSC_SECTION_INDEX: Record<SscTripleSection, number[]> = {
  前三: [0, 1, 2],
  中三: [1, 2, 3],
  後三: [2, 3, 4]
}

/** 注項的樣本空間：命中數 / 母數（賠率由此推導） */
export type SscChance = { hit: number; total: number }

/**
 * 把開獎號正規化成 5 個號碼；格式不合回 null
 * ⚠️ 號碼可重複（與 pk10 的排列不同），所以不檢查唯一性
 */
export function sscDigitsOf(openCode: Array<string | number>): number[] | null {
  const raw = Array.isArray(openCode) ? openCode : []
  if (raw.length !== SSC_BALL_COUNT) return null
  const digits = raw.map((code) => Number(code))
  if (digits.some((num) => !Number.isInteger(num) || num < 0 || num > SSC_DIGIT_MAX)) return null
  return digits
}

/** 總和（5 個號碼相加，0 ~ 45） */
export function sscSumOf(digits: number[]): number {
  return digits.reduce((acc, cur) => acc + cur, 0)
}

/** 取某區段的三個號碼；區段不合回 null */
export function sscSectionOf(digits: number[], section: SscTripleSection): number[] | null {
  const idx = SSC_SECTION_INDEX[section]
  if (!idx) return null
  return idx.map((i) => Number(digits[i]))
}

/**
 * 三球牌型判定（前中後三共用）
 *
 * ⚠️ 順子的定義：三個號碼互不相同且可排成連號。
 *    這裡**不含**跨 9→0 的環狀連號（890、901 不算順子，歸為半順或雜六）——
 *    各平台規則不一，本專案採「不環狀」這一種，改規則要一併調整
 *    sscTripleCounts() 的對帳測試。
 */
export function sscTriplePatternOf(triple: number[]): SscTriplePattern | null {
  const nums = (Array.isArray(triple) ? triple : []).map((n) => Number(n))
  if (nums.length !== 3 || nums.some((n) => !Number.isInteger(n) || n < 0 || n > SSC_DIGIT_MAX)) return null
  const uniq = new Set(nums)
  if (uniq.size === 1) return '豹子'
  if (uniq.size === 2) return '對子'
  // 三個都不同：看排序後是否連號
  const sorted = [...nums].sort((a, b) => a - b) as [number, number, number]
  if (sorted[1] === sorted[0] + 1 && sorted[2] === sorted[1] + 1) return '順子'
  // 有兩個相鄰 → 半順；完全沒有相鄰 → 雜六
  const adjacent = sorted[1] === sorted[0] + 1 || sorted[2] === sorted[1] + 1
  return adjacent ? '半順' : '雜六'
}

/**
 * 鬥牛：5 個號碼中取 3 個，若那三個的和是 10 的倍數就「成牛」，
 * 剩下兩個的和 mod 10 即牛幾（0 代表牛牛）；湊不出來就是沒牛。
 */
export type SscBullResult = { hasBull: true; point: number } | { hasBull: false; point: 0 }

export function sscBullOf(digits: number[]): SscBullResult | null {
  const nums = sscDigitsOf(digits)
  if (!nums) return null
  for (let a = 0; a < 5; a++) {
    for (let b = a + 1; b < 5; b++) {
      for (let c = b + 1; c < 5; c++) {
        if ((nums[a]! + nums[b]! + nums[c]!) % 10 !== 0) continue
        const rest = nums.filter((_, i) => i !== a && i !== b && i !== c)
        const point = (rest[0]! + rest[1]!) % 10
        // 餘數 0 代表牛牛（十點半那種滿牛）
        return { hasBull: true, point }
      }
    }
  }
  return { hasBull: false, point: 0 }
}

/** 梭哈牌型（把 5 個號碼當成牌面比對） */
export type SscShowhandPattern = '五條' | '四條' | '葫蘆' | '順子' | '三條' | '兩對' | '一對' | '散號'

export function sscShowhandOf(digits: number[]): SscShowhandPattern | null {
  const nums = sscDigitsOf(digits)
  if (!nums) return null
  const counts = new Map<number, number>()
  nums.forEach((n) => counts.set(n, (counts.get(n) ?? 0) + 1))
  const shape = [...counts.values()].sort((a, b) => b - a)
  if (shape[0] === 5) return '五條'
  if (shape[0] === 4) return '四條'
  if (shape[0] === 3 && shape[1] === 2) return '葫蘆'
  if (shape[0] === 3) return '三條'
  if (shape[0] === 2 && shape[1] === 2) return '兩對'
  if (shape[0] === 2) return '一對'
  // 五個都不同才可能是順子（同樣不含環狀）
  const sorted = [...nums].sort((a, b) => a - b)
  const straight = sorted.every((n, i) => i === 0 || n === sorted[i - 1]! + 1)
  return straight ? '順子' : '散號'
}

/** 龍虎：兩個球位比大小 */
export type SscDragonResult = '龍' | '和' | '虎'
export function sscDragonOf(digits: number[], indexA: number, indexB: number): SscDragonResult | null {
  const nums = sscDigitsOf(digits)
  if (!nums) return null
  const a = nums[indexA]
  const b = nums[indexB]
  if (a === undefined || b === undefined) return null
  return a > b ? '龍' : a < b ? '虎' : '和'
}

// ── 窮舉快取 ────────────────────────────────────────────────────────────────

/** 算過就存起來：牌型類要跑 1,000 ~ 100,000 次迴圈，同一份結果不重算 */
const _memo = new Map<string, unknown>()
function _cached<T>(key: string, build: () => T): T {
  if (!_memo.has(key)) _memo.set(key, build())
  return _memo.get(key) as T
}

/** 三個號碼的全部 1,000 種組合 */
export function sscAllTriples(): number[][] {
  return _cached('triples', () => {
    const list: number[][] = []
    for (let a = 0; a <= SSC_DIGIT_MAX; a++) {
      for (let b = 0; b <= SSC_DIGIT_MAX; b++) {
        for (let c = 0; c <= SSC_DIGIT_MAX; c++) list.push([a, b, c])
      }
    }
    return list
  })
}

/** 各三球牌型的組合數（合計 1,000） */
export function sscTripleCounts(): Record<SscTriplePattern, number> {
  return _cached('tripleCounts', () => {
    const table = { 豹子: 0, 順子: 0, 對子: 0, 半順: 0, 雜六: 0 } as Record<SscTriplePattern, number>
    sscAllTriples().forEach((triple) => {
      const pattern = sscTriplePatternOf(triple)
      if (pattern) table[pattern] += 1
    })
    return table
  })
}

/** 總和 0 ~ 45 的組合數（合計 100,000）—— 用五重摺積算，不跑 10 萬次迴圈 */
export function sscSumCounts(): Record<number, number> {
  return _cached('sumCounts', () => {
    let dist: number[] = [1]
    for (let ball = 0; ball < SSC_BALL_COUNT; ball++) {
      const next = new Array<number>(dist.length + SSC_DIGIT_MAX).fill(0)
      dist.forEach((count, sum) => {
        // 索引一定在範圍內（next 長度已經加了 SSC_DIGIT_MAX），用 ?? 0 收掉 noUncheckedIndexedAccess
        for (let d = 0; d <= SSC_DIGIT_MAX; d++) next[sum + d] = (next[sum + d] ?? 0) + count
      })
      dist = next
    }
    const table: Record<number, number> = {}
    dist.forEach((count, sum) => { if (count > 0) table[sum] = count })
    return table
  })
}

/** 全部 100,000 種開獎結果（鬥牛／梭哈的機率要用；只在需要時才建） */
export function sscAllOutcomes(): number[][] {
  return _cached('outcomes', () => {
    const list: number[][] = []
    for (let a = 0; a <= SSC_DIGIT_MAX; a++) {
      for (let b = 0; b <= SSC_DIGIT_MAX; b++) {
        for (let c = 0; c <= SSC_DIGIT_MAX; c++) {
          for (let d = 0; d <= SSC_DIGIT_MAX; d++) {
            for (let e = 0; e <= SSC_DIGIT_MAX; e++) list.push([a, b, c, d, e])
          }
        }
      }
    }
    return list
  })
}

/** 全部結果的總數（10⁵） */
export const SSC_TOTAL_OUTCOMES = (SSC_DIGIT_MAX + 1) ** SSC_BALL_COUNT

/** 鬥牛各結果的組合數（沒牛 / 牛1 ~ 牛9 / 牛牛） */
export function sscBullCounts(): Record<string, number> {
  return _cached('bullCounts', () => {
    const table: Record<string, number> = { 沒牛: 0, 牛牛: 0 }
    for (let i = 1; i <= 9; i++) table[`牛${i}`] = 0
    sscAllOutcomes().forEach((digits) => {
      const bull = sscBullOf(digits)
      if (!bull) return
      const key = !bull.hasBull ? '沒牛' : bull.point === 0 ? '牛牛' : `牛${bull.point}`
      table[key] = (table[key] ?? 0) + 1
    })
    return table
  })
}

/** 梭哈各牌型的組合數 */
export function sscShowhandCounts(): Record<SscShowhandPattern, number> {
  return _cached('showhandCounts', () => {
    const table = {
      五條: 0, 四條: 0, 葫蘆: 0, 順子: 0, 三條: 0, 兩對: 0, 一對: 0, 散號: 0
    } as Record<SscShowhandPattern, number>
    sscAllOutcomes().forEach((digits) => {
      const pattern = sscShowhandOf(digits)
      if (pattern) table[pattern] += 1
    })
    return table
  })
}
