import { ToyPlayError, type ToyWalletPort } from './luckyDraw.ts'
import { acquireLock, readPool, releaseLock } from './pool.ts'
import { applyMultiplier, isValidBet } from './reward.ts'
import { resolveFate, resolveWithFate } from './difficulty.ts'

export type PigKind = 'tie' | 'gold' | 'pair' | 'win' | 'tiny' | 'lose'

/**
 * 難度校準：把 `judgePig` 原本的倍數（gold 5／pair 2.5／win 1.9）壓到「贏了大多數只拿回
 * 本金，偶爾多一點，極少數拿到明顯的獎」，讓「有拿回錢（tie／gold／pair／win）」這個
 * 集合的平均倍數落在 ≈1.09（配合難度=1 時 90% 拿回錢，回饋率 ≈98%）。算法見
 * add-toy-shop-admin-controls 設計文件：以 2 顆骰標準分佈算出 tie/gold/pair/win 的自然
 * 頻率（1296 種組合中 146/35/64/476），win／tie 固定 1 倍（只求不虧本），pair 給 1.3 倍，
 * gold 反推成 2.28 倍，讓整體平均剛好 ≈1.09。
 */
const CALIBRATED_MULTIPLIER: Record<PigKind, number> = {
  tie: 1,
  gold: 2.28,
  pair: 1.3,
  win: 1,
  tiny: 0,
  lose: 0
}

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
  difficulty?: number
}): BigPigView {
  if (!acquireLock(input.userId)) throw new ToyPlayError(409, '這一局還在結算，請稍等。')
  try {
    const bet = Number(input.bet)
    if (!isValidBet(bet)) throw new ToyPlayError(400, '注額必須是 1 以上的整數。')
    if (readPool(input.userId)) throw new ToyPlayError(400, '還有未結束的玩具，不能另開一局。')

    const targetWin = resolveFate(input.difficulty ?? 1, input.rng)
    const { player, npc, judged } = resolveWithFate(targetWin, () => {
      const p: [number, number] = [rollDie(input.rng), rollDie(input.rng)]
      const n: [number, number] = [rollDie(input.rng), rollDie(input.rng)]
      const j = judgePig(p, n)
      return { win: j.kind !== 'lose' && j.kind !== 'tiny', player: p, npc: n, judged: j }
    })

    let balance = input.balance
    try {
      balance = input.wallet.debit(input.userId, bet, `大豬公下注 ${bet}`)
    } catch {
      throw new ToyPlayError(400, '餘額不足，無法扣款。')
    }
    const multiplier = CALIBRATED_MULTIPLIER[judged.kind]
    const reward = judged.kind === 'tie' ? bet : applyMultiplier(bet, multiplier)
    if (reward > 0) balance = input.wallet.credit(input.userId, reward, `大豬公結算 ${judged.kind}`)
    return {
      status: 'result',
      player,
      npc,
      kind: judged.kind,
      multiplier: judged.kind === 'tie' ? 0 : multiplier,
      reward,
      balance,
      gameKey: null,
      blocked: false
    }
  } finally {
    releaseLock(input.userId)
  }
}
