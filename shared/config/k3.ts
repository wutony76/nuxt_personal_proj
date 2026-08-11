/**
 * 快3 的骰子基本運算（遊戲層，兩個盤口共用）
 *
 * 開獎為 3 顆骰子、每顆 1 ~ 6，共 6³ = 216 種等機率結果。
 * 這一層只描述「骰子本身」，不含任何盤口的玩法或賠率：
 *   信用盤玩法與賠率 → shared/config/k3-cd.ts
 *   官方盤獎金分層   → shared/config/k3-of.ts
 */

/** 單顆骰子的最大點數 */
export const K3_DICE_MAX = 6
/** 一期開幾顆骰子 */
export const K3_DICE_COUNT = 3
/** 全部可能結果數（6³） */
export const K3_TOTAL_OUTCOMES = K3_DICE_MAX ** K3_DICE_COUNT
/** 和值範圍 */
export const K3_SUM_MIN = K3_DICE_COUNT
export const K3_SUM_MAX = K3_DICE_MAX * K3_DICE_COUNT

/** 把開獎號正規化成 3 顆點數；格式不合回 null */
export function k3DiceOf(openCode: Array<string | number>): number[] | null {
  const raw = Array.isArray(openCode) ? openCode : []
  if (raw.length < K3_DICE_COUNT) return null
  const dice = raw.slice(0, K3_DICE_COUNT).map((code) => Number(code))
  if (dice.some((num) => !Number.isInteger(num) || num < 1 || num > K3_DICE_MAX)) return null
  return dice
}

/** 和值 */
export function k3SumOf(dice: number[]): number {
  return dice.reduce((acc, cur) => acc + cur, 0)
}

/** 是否圍骰（三顆同點） */
export function k3IsTriple(dice: number[]): boolean {
  return dice.every((num) => num === dice[0])
}

/** 點數 → 出現次數 */
export function k3CountMap(dice: number[]): Map<number, number> {
  const map = new Map<number, number>()
  dice.forEach((num) => map.set(num, (map.get(num) ?? 0) + 1))
  return map
}

/** 窮舉全部 216 種結果（供機率計算與測試對帳） */
export function k3AllOutcomes(): number[][] {
  const result: number[][] = []
  for (let a = 1; a <= K3_DICE_MAX; a++) {
    for (let b = 1; b <= K3_DICE_MAX; b++) {
      for (let c = 1; c <= K3_DICE_MAX; c++) result.push([a, b, c])
    }
  }
  return result
}

/**
 * 各和值的結果數（3 ~ 18）
 * 由窮舉建表而非寫死，改動骰子數／點數上限時自動跟上
 */
export const K3_SUM_COUNTS: Record<number, number> = (() => {
  const table: Record<number, number> = {}
  k3AllOutcomes().forEach((dice) => {
    const sum = k3SumOf(dice)
    table[sum] = (table[sum] ?? 0) + 1
  })
  return table
})()
