import { BAMBOO_BANDS, BAMBOO_TARGETS } from './catalog.ts'
import { ToyPlayError, type ToyWalletPort } from './luckyDraw.ts'
import { acquireLock, readPool, releaseLock } from './pool.ts'
import { applyMultiplier, isValidBet } from './reward.ts'
import { resolveFate, resolveWithFate } from './difficulty.ts'

const GAME_KEY = 'bamboo-copter'
export type BambooTargetId = (typeof BAMBOO_TARGETS)[number]['id']

/**
 * 難度校準：不管玩家選哪個高度門檻，難度=1 時都要接近「10 次 9 次達標」，所以達標機率
 * 完全交給 `resolveFate()`／`resolveWithFate()` 決定（見下方 `playBamboo`），不再依賴
 * `BAMBOO_TARGETS` 原本內建的門檻高低差。原本的倍數（1.1~15）會讓「選最高門檻又還能
 * 90% 達標」變成無限提款機，所以這裡另外收斂成一組壓縮過的倍數，讓整體回饋率落在
 * ≈98%～105% 之間（保留一點「選越高越賺」的手感，但不到誇張）。
 */
const CALIBRATED_TARGET_MULTIPLIER: Record<BambooTargetId, number> = {
  m10: 1,
  m20: 1.05,
  m30: 1.15,
  m40: 1.3,
  m50: 1.5
}

export type BambooView = {
  status: 'idle' | 'result'
  height: number | null
  target: BambooTargetId | null
  hit: boolean | null
  multiplier: number
  reward: number
  balance: number
  gameKey: string | null
  blocked: boolean
}

/**
 * @param rng 決定高度帶與帶內公尺
 * @returns 這一局唯一的高度。動畫與判定都用它
 */
export function drawBambooHeight(rng: () => number): number {
  const ticket = Math.min(9999, Math.floor(rng() * 10000))
  let cursor = 0
  for (const band of BAMBOO_BANDS) {
    const next = cursor + band.weight
    if (ticket < next) {
      const span = band.max - band.min + 1
      const offset = Math.min(span - 1, Math.floor(((ticket - cursor) * span) / band.weight))
      return band.min + offset
    }
    cursor = next
  }
  return BAMBOO_BANDS[BAMBOO_BANDS.length - 1]?.max ?? 0
}

/**
 * @param userId 帳號 id
 * @param balance 目前 F 幣
 * @returns 竹蜻蜓畫面。這款不留未領金額
 */
export function snapshotBamboo(userId: string, balance: number): BambooView {
  const pool = readPool(userId)
  return {
    status: 'idle',
    height: null,
    target: null,
    hit: null,
    multiplier: 0,
    reward: 0,
    balance,
    gameKey: pool?.gameKey ?? null,
    blocked: pool != null
  }
}

/**
 * @param input.target 玩家選的高度門檻
 * @returns 同一請求已結清的結果
 */
export function playBamboo(input: {
  userId: string
  bet?: number
  target?: BambooTargetId
  balance: number
  rng: () => number
  wallet: ToyWalletPort
  difficulty?: number
}): BambooView {
  if (!acquireLock(input.userId)) throw new ToyPlayError(409, '這一局還在結算，請稍等。')
  try {
    const bet = Number(input.bet)
    const target = BAMBOO_TARGETS.find((item) => item.id === input.target)
    if (!isValidBet(bet)) throw new ToyPlayError(400, '注額必須是 1 以上的整數。')
    if (!target) throw new ToyPlayError(400, '請選一個高度。')
    if (readPool(input.userId)) throw new ToyPlayError(400, '還有未結束的玩具，不能另開一局。')

    const targetWin = resolveFate(input.difficulty ?? 1, input.rng)
    const { height, win: hit } = resolveWithFate(targetWin, () => {
      const h = drawBambooHeight(input.rng)
      return { win: h >= target.min, height: h }
    })

    let balance = input.balance
    try {
      balance = input.wallet.debit(input.userId, bet, `竹蜻蜓下注 ${bet}`)
    } catch {
      throw new ToyPlayError(400, '餘額不足，無法扣款。')
    }
    const multiplier = CALIBRATED_TARGET_MULTIPLIER[target.id]
    const reward = hit ? applyMultiplier(bet, multiplier) : 0
    if (reward > 0) {
      balance = input.wallet.credit(input.userId, reward, `竹蜻蜓達標 ${height}m`)
    }
    return {
      status: 'result',
      height,
      target: target.id,
      hit,
      multiplier: hit ? multiplier : 0,
      reward,
      balance,
      gameKey: null,
      blocked: false
    }
  } finally {
    releaseLock(input.userId)
  }
}
