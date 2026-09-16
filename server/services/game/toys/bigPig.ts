import { ToyPlayError, type ToyWalletPort } from './luckyDraw.ts'
import { acquireLock, readPool, releaseLock } from './pool.ts'
import { applyMultiplier, isValidBet } from './reward.ts'

export type PigKind = 'tie' | 'gold' | 'pair' | 'win' | 'tiny' | 'lose'

export type BigPigView = {
  status: 'idle' | 'result'
  player: [number, number] | null
  npc: [number, number] | null
  kind: PigKind | null
  multiplier: number
  reward: number
  balance: number
  gameKey: string | null
  blocked: boolean
}

/**
 * @param rng 決定 1–6
 * @returns 一顆骰子
 */
export function rollDie(rng: () => number): number {
  return 1 + Math.min(5, Math.floor(rng() * 6))
}

/**
 * @param player 玩家兩顆
 * @param npc 對方兩顆
 * @returns 比完點數和之後的牌型。和局不套特殊
 */
export function judgePig(player: [number, number], npc: [number, number]): { kind: PigKind; multiplier: number } {
  const playerSum = player[0] + player[1]
  const npcSum = npc[0] + npc[1]
  if (playerSum === npcSum) return { kind: 'tie', multiplier: 1 }
  if (playerSum < npcSum) {
    const tiny = player[0] === 1 && player[1] === 1
    return { kind: tiny ? 'tiny' : 'lose', multiplier: 0 }
  }
  if (player[0] === 6 && player[1] === 6) return { kind: 'gold', multiplier: 5 }
  if (player[0] === player[1]) return { kind: 'pair', multiplier: 2.5 }
  return { kind: 'win', multiplier: 1.9 }
}

/**
 * @param userId 帳號 id
 * @param balance 目前 F 幣
 * @returns 大豬公畫面。這款不留未領金額
 */
export function snapshotBigPig(userId: string, balance: number): BigPigView {
  const pool = readPool(userId)
  return {
    status: 'idle',
    player: null,
    npc: null,
    kind: null,
    multiplier: 0,
    reward: 0,
    balance,
    gameKey: pool?.gameKey ?? null,
    blocked: pool != null
  }
}

/**
 * @param input.bet 注額
 * @returns 四顆骰已決定、同一請求已結清的結果
 */
export function playBigPig(input: {
  userId: string
  bet?: number
  balance: number
  rng: () => number
  wallet: ToyWalletPort
}): BigPigView {
  if (!acquireLock(input.userId)) throw new ToyPlayError(409, '這一局還在結算，請稍等。')
  try {
    const bet = Number(input.bet)
    if (!isValidBet(bet)) throw new ToyPlayError(400, '注額必須是 1 以上的整數。')
    if (readPool(input.userId)) throw new ToyPlayError(400, '還有未結束的玩具，不能另開一局。')
    const player: [number, number] = [rollDie(input.rng), rollDie(input.rng)]
    const npc: [number, number] = [rollDie(input.rng), rollDie(input.rng)]
    const judged = judgePig(player, npc)
    let balance = input.balance
    try {
      balance = input.wallet.debit(input.userId, bet, `大豬公下注 ${bet}`)
    } catch {
      throw new ToyPlayError(400, '餘額不足，無法扣款。')
    }
    const reward = judged.kind === 'tie' ? bet : applyMultiplier(bet, judged.multiplier)
    if (reward > 0) balance = input.wallet.credit(input.userId, reward, `大豬公結算 ${judged.kind}`)
    return {
      status: 'result',
      player,
      npc,
      kind: judged.kind,
      multiplier: judged.kind === 'tie' ? 0 : judged.multiplier,
      reward,
      balance,
      gameKey: null,
      blocked: false
    }
  } finally {
    releaseLock(input.userId)
  }
}
