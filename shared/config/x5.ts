/**
 * 11選5（X5）的基本運算與號碼判定（遊戲層，兩個盤口共用）
 *
 * 開獎為 5 個號碼、每個 1 ~ 11 且**互不重複**（第一 ~ 第五球，有位置），
 * 所以同一個彩種有兩種母數，用錯就會算錯賠率：
 *
 *   | 判定對象           | 母數                | 用在                          |
 *   |--------------------|---------------------|-------------------------------|
 *   | 單一球位的號碼分布 | 11（邊際分布）      | 單球號碼 1/11、單球大小單雙   |
 *   | 兩球位的相對大小   | 2（對稱）           | 龍虎鬥 龍/虎 各 1/2           |
 *   | 5 碼的**集合**性質 | C(11,5) = 462       | 總和、全5中1、爆池、任選      |
 *   | 5 碼的**排列**性質 | P(11,5) = 55,440    | （官方盤）直選類              |
 *
 * ⚠️ 邊際分布為什麼是均勻的：抽 5 個不重複號碼、位置隨機，
 *    任一球位落在任一號碼的機率都是 1/11（超幾何分布的邊際均勻性），
 *    所以單球類直接用 11 當母數，不必窮舉 55,440。
 * ⚠️ 但**總和不能用邊際分布算** —— 5 個號碼不獨立（不重複），
 *    必須窮舉 462 種組合建表。這是與 SSC（號碼可重複、總和可用摺積）最大的差別。
 *
 * ── 與 ssc / k3 / pk10 的分工一致 ──────────────────────────
 *   本檔                      號碼運算 + 機率窮舉
 *   shared/config/x5-cd.ts    信用盤：注碼判定 + 賠率推導 + 爆池
 *   shared/config/x5-of.ts    官方盤：同上（階段 2）
 *   shared/config/x5cd|x5of   看板設定（注項、限額、爆池權重），由 helpers 讀取
 *
 * ⚠️ 本檔不可 import 任何 helpers（helpers 會 import 本檔，會形成循環）。
 */

/** 一期開幾個號碼 */
export const X5_BALL_COUNT = 5
/** 號碼範圍（1 ~ 11） */
export const X5_NUMBER_MIN = 1
export const X5_NUMBER_MAX = 11
/** 全部可下注號碼（1 ~ 11） */
export const X5_NUMBERS: number[] = Array.from(
  { length: X5_NUMBER_MAX - X5_NUMBER_MIN + 1 },
  (_, i) => X5_NUMBER_MIN + i
)

/**
 * 單球大小分界：號碼 ≥ 7 為大
 * 出處：bglottery `src/components/common/roadMap.vue` 的 `c < 7 ? '小' : '大'`，
 *      以及 `config_11x5.js` 每個 selectarea 的 `noBigIndex: 7`。
 * ⚠️ 11 個號碼切在 6/7 → 大只有 5 個號（7~11）、小有 6 個號（1~6），本來就不對稱。
 */
export const X5_BIG_LINE = 7

/** 總和範圍（1+2+3+4+5 ~ 7+8+9+10+11） */
export const X5_SUM_MIN = 15
export const X5_SUM_MAX = 45
/**
 * 總和大小分界：總和 ≥ 31 為大
 * 出處：bglottery `roadMap.vue` 的 `c < 31 ? '小' : '大'`。
 * ⚠️ 分佈對稱於 30 而界線切在 30/31 → 30 那 32 種歸小，
 *    所以總和大（215）與總和小（247）機率不同、賠率也不同。
 */
export const X5_SUM_BIG_LINE = 31
/**
 * 總和尾數大小分界：總和個位數 ≥ 5 為尾大
 * ⚠️ **使用者於提案階段確認之門檻，非原始碼依據** ——
 *    來源 `config_11x5_credit.js` 的總和分頁有 6 個 playId，
 *    但只有大小（界線 31）與單雙 4 項在 `roadMap.vue` 找得到判定依據，
 *    尾碼 14/15 那兩項的名稱與規則由使用者拍板為「尾大／尾小」。
 *    要改門檻只需改這一處。
 */
export const X5_SUM_TAIL_BIG_LINE = 5

/** 球位名稱（index 0 = 第一球） */
export const X5_BALL_NAMES = ['第一球', '第二球', '第三球', '第四球', '第五球'] as const
export type X5BallName = (typeof X5_BALL_NAMES)[number]

/** 5 碼**組合**的總數 C(11,5)；集合性質（總和／全5中1／爆池／任選）的母數 */
export const X5_TOTAL_COMBOS = 462
/** 5 碼**排列**的總數 P(11,5)；官方盤直選類的母數 */
export const X5_TOTAL_PERMS = 55440

/** 注項的樣本空間：命中數 / 母數（賠率由此推導） */
export type X5Chance = { hit: number; total: number }

/** 號碼顯示格式（一律補零兩位：01 ~ 11） */
export function x5NumberLabel(num: number): string {
  return String(num).padStart(2, '0')
}

/**
 * 把開獎號正規化成 5 個號碼；格式不合回 null
 * ⚠️ 與 ssc 不同，這裡**必須**檢查唯一性（11選5 是不重複抽樣）
 */
export function x5NumbersOf(openCode: Array<string | number>): number[] | null {
  const raw = Array.isArray(openCode) ? openCode : []
  if (raw.length !== X5_BALL_COUNT) return null
  const nums = raw.map((code) => Number(code))
  if (nums.some((n) => !Number.isInteger(n) || n < X5_NUMBER_MIN || n > X5_NUMBER_MAX)) return null
  if (new Set(nums).size !== nums.length) return null
  return nums
}

/** 總和（5 個號碼相加，15 ~ 45） */
export function x5SumOf(nums: number[]): number {
  return nums.reduce((acc, cur) => acc + Number(cur), 0)
}

/** 總和的個位數（尾大／尾小用） */
export function x5SumTailOf(nums: number[]): number {
  return x5SumOf(nums) % 10
}

/**
 * 龍虎：兩個球位比大小
 * ⚠️ 沒有「和」—— 5 個號碼互不重複，兩球位不可能相等。
 *    真的相等（開獎資料異常）回 null，由呼叫端當成無法判定處理，不硬塞一個結果。
 */
export type X5DragonResult = '龍' | '虎'
export function x5DragonOf(nums: number[], indexA: number, indexB: number): X5DragonResult | null {
  const a = nums[indexA]
  const b = nums[indexB]
  if (a === undefined || b === undefined) return null
  if (a === b) return null
  return a > b ? '龍' : '虎'
}

/** 五碼的單雙同面（爆池條件用）；混合回 null */
export type X5ParityAll = '全單' | '全雙'
export function x5ParityAllOf(nums: number[]): X5ParityAll | null {
  if (!nums.length) return null
  if (nums.every((n) => Number(n) % 2 === 1)) return '全單'
  if (nums.every((n) => Number(n) % 2 === 0)) return '全雙'
  return null
}

// ── 窮舉快取 ────────────────────────────────────────────────────────────────

/** 算過就存起來：462 種組合只建一次 */
const _memo = new Map<string, unknown>()
function _cached<T>(key: string, build: () => T): T {
  if (!_memo.has(key)) _memo.set(key, build())
  return _memo.get(key) as T
}

/** 全部 C(11,5) = 462 種號碼組合（遞增排序，不含位置資訊） */
export function x5AllCombos(): number[][] {
  return _cached('combos', () => {
    const list: number[][] = []
    const acc: number[] = []
    const walk = (start: number): void => {
      if (acc.length === X5_BALL_COUNT) {
        list.push([...acc])
        return
      }
      for (let n = start; n <= X5_NUMBER_MAX; n++) {
        acc.push(n)
        walk(n + 1)
        acc.pop()
      }
    }
    walk(X5_NUMBER_MIN)
    return list
  })
}

/** 總和 15 ~ 45 的組合數（合計 462，對稱於 30） */
export function x5SumCounts(): Record<number, number> {
  return _cached('sumCounts', () => {
    const table: Record<number, number> = {}
    x5AllCombos().forEach((combo) => {
      const sum = x5SumOf(combo)
      table[sum] = (table[sum] ?? 0) + 1
    })
    return table
  })
}

/**
 * 依條件數算命中數（母數固定 462）
 * 集合性質的注項（總和／全5中1／爆池）都走這支，避免各處自己寫迴圈
 */
export function x5ComboHits(match: (combo: number[]) => boolean): number {
  return x5AllCombos().reduce((acc, combo) => (match(combo) ? acc + 1 : acc), 0)
}
