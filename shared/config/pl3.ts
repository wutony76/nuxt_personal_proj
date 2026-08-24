/**
 * 排列3（PL3）的基本運算與機率窮舉（遊戲層，只有官方盤一個盤口）
 *
 * 開獎為 3 個 0 ~ 9 的號碼（百/十/個位）、可重複，共 10³ = 1,000 種等機率結果 ——
 * 全部可窮舉，所以機率是精確值（純 `Number` 即可，規模遠小於 kl8 的 C(80,20)，不需 BigInt）。
 *
 * ── 與 eggs / ssc 的分工一致 ─────────────────────────────
 *   本檔                          號碼運算 + 機率窮舉那一層（比照 eggs.ts / ssc.ts）
 *   shared/config/pl3-of.ts      官方盤：注碼判定 + 賠率推導 + 複式展開（比照 sscof.ts）
 *   shared/config/pl3of/         看板設定（注項、限額），由 helpers 讀取（比照 sscof/）
 *
 * ── 來源與規則依據 ───────────────────────────────────────
 *   玩法名稱／分類／playId：bglottery `pl3/config_ssc.js`（lotteryId 1901，只有官方盤）
 *   開獎位數（3 位 0~9）：`pl3/header.vue` 開獎動畫 `for(i=0;i<3;i++){random(0,9)}`
 *   和值窮舉表：與來源 `official/js/algorithm.js` 的 `ZXHZ` 常數（母數 1000）逐值吻合
 *   組選和值排除豹子：與來源 `ZUSHZ` 排列數推導一致（見 pl3GroupSumCounts 註解）
 *   ⚠️ 本檔不可 import pl3-of.ts / helpers（那邊會 import 本檔，會形成循環）。
 */

/** 一期開幾個號碼（百/十/個位） */
export const PL3_DIGIT_COUNT = 3
/** 每個號碼的最小值 */
export const PL3_DIGIT_MIN = 0
/** 每個號碼的最大值（0 ~ 9） */
export const PL3_DIGIT_MAX = 9
/** 全部可能結果數（10³ = 1,000） */
export const PL3_TOTAL_OUTCOMES = (PL3_DIGIT_MAX + 1) ** PL3_DIGIT_COUNT
/** 和值範圍（3 個 0 ~ 3 個 9） */
export const PL3_SUM_MIN = 0
export const PL3_SUM_MAX = PL3_DIGIT_MAX * PL3_DIGIT_COUNT

/**
 * 和值大小分界（僅供路珠／開獎歷史等純顯示用途，非任何投注玩法的判定依據）
 *
 * pl3 沒有「總和大小」這個可下注玩法（大小單雙是逐位判定，見 pl3-of.ts），
 * 這裡沿用與 EGGS_BIG_LINE 相同的公開慣例（3 位數 0~27，>13 為大）純粹讓路珠／
 * 歷史面板有東西可以標示，不影響任何賠率或結算邏輯。
 */
export const PL3_SUM_BIG_LINE = 13

/** 位數名稱（index 0 = 百位、1 = 十位、2 = 個位），也是定位膽注碼的前綴 */
export const PL3_PLACE_NAMES = ['百位', '十位', '個位'] as const

/** 注項的樣本空間：命中數 / 母數（賠率由此推導） */
export type Pl3Chance = { hit: number; total: number }

/**
 * 把開獎號正規化成 3 個號碼；格式不合回 null
 * ⚠️ 號碼可重複（可以開出 111），所以不檢查唯一性
 */
export function pl3DigitsOf(openCode: Array<string | number>): number[] | null {
  const raw = Array.isArray(openCode) ? openCode : []
  if (raw.length !== PL3_DIGIT_COUNT) return null
  const digits = raw.map((code) => Number(code))
  if (digits.some((num) => !Number.isInteger(num) || num < PL3_DIGIT_MIN || num > PL3_DIGIT_MAX)) return null
  return digits
}

/** 和值（3 個號碼相加，0 ~ 27） */
export function pl3SumOf(digits: number[]): number {
  return (Array.isArray(digits) ? digits : []).reduce((acc, cur) => acc + Number(cur), 0)
}

/**
 * 豹子判定（三碼相同，如 000 / 555 / 999）
 *
 * 用於三星組選和值排除豹子：組選和值要求「和值命中且非豹子」，
 * 豹子即使和值對上也不算中（見 pl3-of.ts 的 groupSumValue 判定）。
 */
export function pl3IsTriple(digits: number[]): boolean {
  const nums = (Array.isArray(digits) ? digits : []).map((n) => Number(n))
  if (nums.length !== PL3_DIGIT_COUNT) return false
  const first = nums[0]
  return nums.every((n) => n === first)
}

// ── 窮舉快取 ────────────────────────────────────────────────────────────────

/** 算過就存起來：和值表要跑 1,000 次迴圈，同一份結果不重算 */
const _memo = new Map<string, unknown>()
function _cached<T>(key: string, build: () => T): T {
  if (!_memo.has(key)) _memo.set(key, build())
  return _memo.get(key) as T
}

/** 全部 1,000 種開獎結果 */
export function pl3AllOutcomes(): number[][] {
  return _cached('outcomes', () => {
    const list: number[][] = []
    for (let h = PL3_DIGIT_MIN; h <= PL3_DIGIT_MAX; h++) {
      for (let t = PL3_DIGIT_MIN; t <= PL3_DIGIT_MAX; t++) {
        for (let u = PL3_DIGIT_MIN; u <= PL3_DIGIT_MAX; u++) list.push([h, t, u])
      }
    }
    return list
  })
}

/**
 * 三星直選和值（ZXHZ）：各和值 0 ~ 27 的結果數（合計 1,000）
 *
 * 窮舉全部 1,000 種 h/t/u 組合逐一計和 —— 不寫死查表，符合本專案
 * 「窮舉驗證，不寫死猜測數字」的慣例。結果與來源 `algorithm.js` 的 `ZXHZ`
 * 常數（`{0:1,1:3,...,13:75,14:75,...,27:1}`）逐值吻合。
 */
export function pl3SumCounts(): Record<number, number> {
  return _cached('sumCounts', () => {
    const table: Record<number, number> = {}
    for (let h = PL3_DIGIT_MIN; h <= PL3_DIGIT_MAX; h++) {
      for (let t = PL3_DIGIT_MIN; t <= PL3_DIGIT_MAX; t++) {
        for (let u = PL3_DIGIT_MIN; u <= PL3_DIGIT_MAX; u++) {
          const sum = h + t + u
          table[sum] = (table[sum] ?? 0) + 1
        }
      }
    }
    return table
  })
}

/**
 * 三星組選和值（ZUSHZ）：各和值 1 ~ 26 的「非豹子」結果數（合計 990）
 *
 * 與 pl3SumCounts 同樣窮舉 1,000 種結果，但**排除 10 個豹子**（000/111/…/999）——
 * 組選和值的中獎條件是「和值命中且非豹子」，豹子那 10 種不算中，故從命中數扣除。
 * 扣除後只影響 3 的倍數和值（豹子的和值恰為 3n）：
 *   sum 0/27（豹子 000/999）→ 命中 0，故此表只到 1 ~ 26。
 *   sum 3→9(=10-1)、6→27(=28-1)、9→54、12→72、15→72、18→54、21→27、24→9。
 * 加總 = 1,000 − 10 = 990，與來源 `ZUSHZ` 排列數推導一致。
 *
 * ⚠️ 這是「命中排列數」表（加總 990），不是 `algorithm.js` 裡 `cc` 那份「組合數」表
 *    （加總 210，來源用來算 UI 複式展開注數）。判定賠率的機率分母一律是全部 1,000 種開獎，
 *    命中數才取這張排列數表 —— 詳見 pl3-of.ts 的 groupSumValue 賠率推導。
 */
export function pl3GroupSumCounts(): Record<number, number> {
  return _cached('groupSumCounts', () => {
    const table: Record<number, number> = {}
    for (let h = PL3_DIGIT_MIN; h <= PL3_DIGIT_MAX; h++) {
      for (let t = PL3_DIGIT_MIN; t <= PL3_DIGIT_MAX; t++) {
        for (let u = PL3_DIGIT_MIN; u <= PL3_DIGIT_MAX; u++) {
          if (h === t && t === u) continue // 排除豹子
          const sum = h + t + u
          table[sum] = (table[sum] ?? 0) + 1
        }
      }
    }
    return table
  })
}
