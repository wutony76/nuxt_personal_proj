/**
 * 快3 官方盤（K3-OF）判定與獎金分層
 *
 * ── 玩法 ────────────────────────────────────────────────
 *   一注 = 選 3 個點數（1 ~ 6，可重複，如 [2,4,6] 或 [1,1,5]），
 *   依「命中幾顆」分層從獎池按比例分配，與 6hc-of 的獎池分層同一套語意。
 *
 * ── 命中數的定義：多重集交集 ─────────────────────────────
 *   骰子點數可重複，所以不能用 Set 交集。
 *   例：選 [2,2,4]、開 [2,4,4] → 交集 {2,4} → 命中 2 顆
 *       選 [2,2,4]、開 [2,2,2] → 交集 {2,2} → 命中 2 顆
 *   也就是「每個點數取兩邊出現次數的較小值後加總」，上限 3。
 *
 * ── 與 K3-CD 的關係 ─────────────────────────────────────
 *   開獎號與彩池由 server/services/k3Shared.ts 共用，
 *   本檔只負責「一注怎麼判、命中幾顆屬哪一層」，不碰狀態。
 */
import { k3DiceOf, K3_DICE_COUNT, K3_DICE_MAX } from '#shared/config/k3'

/** 一注要選幾個點數（與開獎顆數相同） */
export const K3_OF_PICK_COUNT = K3_DICE_COUNT

/**
 * 獎金分層
 *   pool  —— 從該期可發放獎池按 ratio 切一塊，再依中獎者的下注額比例分配
 *            minAmount 為「每單位下注」的最低保障（僅頭獎設，避免下全注套利）
 *   fixed —— 固定倍數，直接按下注倍數發放
 * ⚠️ 未產生中獎者的 pool 層，該層獎金整塊滾存至下期（與 6hc-of 相同）
 */
export type K3OfPrizeTier =
  | { match: number; type: 'pool'; ratio: number; minAmount?: number; name: string }
  | { match: number; type: 'fixed'; amount: number; name: string }

export const K3_OF_PRIZE_TIERS: K3OfPrizeTier[] = [
  { match: 3, type: 'pool', ratio: 0.70, minAmount: 20000, name: '頭獎' },
  { match: 2, type: 'pool', ratio: 0.20, name: '二獎' },
  { match: 1, type: 'fixed', amount: 2, name: '三獎' }
]

/**
 * pool 型分層的 ratio 總和（未派出時的滾存計算會用到）
 * ⚠️ 要收斂小數：0.70 + 0.20 的浮點結果是 0.8999999999999999，
 *    直接拿去乘獎池會產生一分錢級別的誤差
 */
export const K3_OF_POOL_RATIO_TOTAL = Number(
  K3_OF_PRIZE_TIERS
    .filter((tier): tier is Extract<K3OfPrizeTier, { type: 'pool' }> => tier.type === 'pool')
    .reduce((sum, tier) => sum + tier.ratio, 0)
    .toFixed(4)
)

/** 把注碼正規化成 3 個點數（升冪）；格式不合回 null */
export function k3OfPicksOf(betCode: Array<string | number>): number[] | null {
  const raw = Array.isArray(betCode) ? betCode : []
  if (raw.length !== K3_OF_PICK_COUNT) return null
  const picks = raw.map((code) => Number(code))
  if (picks.some((num) => !Number.isInteger(num) || num < 1 || num > K3_DICE_MAX)) return null
  return [...picks].sort((a, b) => a - b)
}

/**
 * 命中顆數（多重集交集大小）
 * @returns 0 ~ 3；注碼或開獎格式不合回 null（呼叫端應視為無效注單）
 */
export function k3OfMatchCount(
  betCode: Array<string | number>,
  openCode: Array<string | number>
): number | null {
  const picks = k3OfPicksOf(betCode)
  const dice = k3DiceOf(openCode)
  if (!picks || !dice) return null
  const remain = [...dice]
  let matched = 0
  picks.forEach((pick) => {
    const idx = remain.indexOf(pick)
    // 每顆開獎骰子只能被用掉一次，這樣才是多重集交集而非「有沒有出現」
    if (idx >= 0) {
      remain.splice(idx, 1)
      matched++
    }
  })
  return matched
}

/** 命中顆數 → 所屬分層；不中回 null */
export function k3OfTierOf(matchCount: number): K3OfPrizeTier | null {
  const count = Number(matchCount)
  if (!Number.isInteger(count) || count <= 0) return null
  return K3_OF_PRIZE_TIERS.find((tier) => tier.match === count) ?? null
}

/** 全部可選的注碼（不同的點數多重集，共 C(6+3-1,3) = 56 組），供看板與測試列舉 */
export function k3OfAllPicks(): number[][] {
  const result: number[][] = []
  for (let a = 1; a <= K3_DICE_MAX; a++) {
    for (let b = a; b <= K3_DICE_MAX; b++) {
      for (let c = b; c <= K3_DICE_MAX; c++) result.push([a, b, c])
    }
  }
  return result
}
