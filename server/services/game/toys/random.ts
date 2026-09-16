export type WeightedItem = {
  weight: number
}

/**
 * @param values 依序回傳的 0–1 隨機值，用完後重複最後一個
 * @returns 可注入的隨機函式
 */
export function createSequenceRng(values: number[]): () => number {
  let index = 0
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0
    index += 1
    return value
  }
}

/**
 * @param items 帶 weight 的項目
 * @param rng 回傳 0 以上、1 未滿
 * @returns 抽中的那一項
 */
export function pickWeighted<T extends WeightedItem>(items: T[], rng: () => number): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  if (total <= 0 || items.length === 0) {
    throw new Error('加權表是空的')
  }
  let cursor = rng() * total
  for (const item of items) {
    cursor -= item.weight
    if (cursor < 0) return item
  }
  return items[items.length - 1] as T
}
