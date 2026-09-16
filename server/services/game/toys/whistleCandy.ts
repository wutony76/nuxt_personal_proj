import { ToyPlayError, type ToyWalletPort } from './luckyDraw.ts'
import { acquireLock, readPool, releaseLock } from './pool.ts'
import { applyMultiplier, isValidBet } from './reward.ts'

export const WHISTLE_CHOICES = ['short', 'mid', 'long'] as const
export type WhistleChoice = (typeof WHISTLE_CHOICES)[number]
export type WhistleOutcome = 'win' | 'tie' | 'lose'

const histories = new Map<string, WhistleChoice[]>()

export type WhistleView = {
  status: 'idle' | 'result'
  player: WhistleChoice | null
  npc: WhistleChoice | null
  outcome: WhistleOutcome | null
  multiplier: number
  reward: number
  history: WhistleChoice[]
  balance: number
  gameKey: string | null
  blocked: boolean
}

/**
 * @param rng 均勻隨機，不做預測
 * @returns NPC 的短、中或長
 */
export function drawWhistle(rng: () => number): WhistleChoice {
  return WHISTLE_CHOICES[Math.min(2, Math.floor(rng() * 3))] ?? 'short'
}

/**
 * @param player 玩家選擇
 * @param npc 已抽出的 NPC
 * @returns 短勝長、長勝中、中勝短，相同為平手
 */
export function judgeWhistle(player: WhistleChoice, npc: WhistleChoice): WhistleOutcome {
  if (player === npc) return 'tie'
  if (player === 'short' && npc === 'long') return 'win'
  if (player === 'long' && npc === 'mid') return 'win'
  if (player === 'mid' && npc === 'short') return 'win'
  return 'lose'
}

function remember(userId: string, choice: WhistleChoice): WhistleChoice[] {
  const next = [...(histories.get(userId) ?? []), choice].slice(-8)
  histories.set(userId, next)
  return next
}

/** 測試用：清掉哨子糖歷史 */
export function resetWhistleHistory(): void {
  histories.clear()
}

/**
 * @param userId 帳號 id
 * @param balance 目前 F 幣
 * @returns 哨子糖畫面。這款不留未領金額
 */
export function snapshotWhistle(userId: string, balance: number): WhistleView {
  const pool = readPool(userId)
  return {
    status: 'idle',
    player: null,
    npc: null,
    outcome: null,
    multiplier: 0,
    reward: 0,
    history: histories.get(userId) ?? [],
    balance,
    gameKey: pool?.gameKey ?? null,
    blocked: pool != null
  }
}

/**
 * @param input.choice 玩家選的短、中、長
 * @returns 倒數開始前已決定的結果
 */
export function playWhistle(input: {
  userId: string
  bet?: number
  choice?: WhistleChoice
  balance: number
  rng: () => number
  wallet: ToyWalletPort
}): WhistleView {
  if (!acquireLock(input.userId)) throw new ToyPlayError(409, '這一局還在結算，請稍等。')
  try {
    const bet = Number(input.bet)
    const player = input.choice
    if (!isValidBet(bet)) throw new ToyPlayError(400, '注額必須是 1 以上的整數。')
    if (!WHISTLE_CHOICES.includes(player as WhistleChoice)) throw new ToyPlayError(400, '請選短、中或長。')
    if (readPool(input.userId)) throw new ToyPlayError(400, '還有未結束的玩具，不能另開一局。')
    const npc = drawWhistle(input.rng)
    const outcome = judgeWhistle(player as WhistleChoice, npc)
    const history = remember(input.userId, npc)
    let balance = input.balance
    try {
      balance = input.wallet.debit(input.userId, bet, `哨子糖下注 ${bet}`)
    } catch {
      histories.set(input.userId, history.slice(0, -1))
      throw new ToyPlayError(400, '餘額不足，無法扣款。')
    }
    const multiplier = outcome === 'win' ? 1.9 : 0
    const reward = outcome === 'tie' ? bet : applyMultiplier(bet, multiplier)
    if (reward > 0) balance = input.wallet.credit(input.userId, reward, `哨子糖結算 ${outcome}`)
    return {
      status: 'result',
      player: player as WhistleChoice,
      npc,
      outcome,
      multiplier,
      reward,
      history,
      balance,
      gameKey: null,
      blocked: false
    }
  } finally {
    releaseLock(input.userId)
  }
}
