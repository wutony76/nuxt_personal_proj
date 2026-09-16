import { acquireLock, clearPool, readPool, releaseLock, writePool } from './pool.ts'
import { ToyPlayError, type ToyWalletPort } from './luckyDraw.ts'
import { TOY_MAX_POT_MULTIPLIER } from './catalog.ts'
import { applyMultiplier, clampPot, isValidBet } from './reward.ts'

export type CardChoice = 'high' | 'low' | 'same'
export const CARD_STREAK = [1.8, 3, 5, 8, 15] as const
export const CARD_SAME_MULTIPLIER = 10
const GAME_KEY = 'cards'

export type CardsMeta = {
  rank: number
  deck: number[]
  streak: number
}

export type CardsView = {
  status: 'idle' | 'result'
  rank: number | null
  nextRank: number | null
  choice: CardChoice | null
  correct: boolean | null
  multiplier: number
  streak: number
  unclaimed: number
  reward: number
  balance: number
  claimed: boolean
  canGuess: boolean
  canClaim: boolean
  gameKey: string | null
}

/**
 * @returns 新的 1–13 牌組
 */
export function freshDeck(): number[] {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
}

/**
 * @param deck 剩餘牌，空了就重洗
 * @param rng 決定抽哪一張
 * @returns 抽出的點數與剩下的牌
 */
export function drawRank(deck: number[], rng: () => number): { rank: number; deck: number[] } {
  const pile = deck.length > 0 ? deck.slice() : freshDeck()
  const index = Math.min(pile.length - 1, Math.floor(rng() * pile.length))
  const rank = pile[index] as number
  pile.splice(index, 1)
  return { rank, deck: pile }
}

/**
 * @param current 目前牌
 * @param next 下一張
 * @param choice 大、小或相同
 * @returns 是否猜中
 */
export function judgeCard(current: number, next: number, choice: CardChoice): boolean {
  if (choice === 'high') return next > current
  if (choice === 'low') return next < current
  return next === current
}

/**
 * @param streak 已連勝次數
 * @param choice 本回選擇
 * @returns 本回倍率。相同固定 10，大／小走連勝表
 */
export function cardMultiplier(streak: number, choice: CardChoice): number {
  if (choice === 'same') return CARD_SAME_MULTIPLIER
  return CARD_STREAK[Math.min(streak, CARD_STREAK.length - 1)] ?? 1.8
}

function readMeta(userId: string): CardsMeta | null {
  const pool = readPool(userId)
  if (!pool || pool.gameKey !== GAME_KEY || !pool.meta) return null
  return pool.meta as CardsMeta
}

/**
 * @param userId 帳號 id
 * @param balance 目前 F 幣
 * @returns 紙牌畫面
 */
export function snapshotCards(userId: string, balance: number): CardsView {
  const pool = readPool(userId)
  const meta = readMeta(userId)
  const owned = pool?.gameKey === GAME_KEY
  return {
    status: owned ? 'result' : 'idle',
    rank: meta?.rank ?? null,
    nextRank: null,
    choice: null,
    correct: null,
    multiplier: 0,
    streak: meta?.streak ?? 0,
    unclaimed: owned ? pool?.unclaimed ?? 0 : 0,
    reward: 0,
    balance,
    claimed: false,
    canGuess: owned && (meta?.streak ?? 0) < CARD_STREAK.length,
    canClaim: owned && (pool?.unclaimed ?? 0) > 0,
    gameKey: pool?.gameKey ?? null
  }
}

/**
 * @param input.action 開局、猜牌或領取
 * @returns 結算後的畫面
 */
export function playCards(input: {
  userId: string
  action: 'start' | 'guess' | 'claim'
  bet?: number
  choice?: CardChoice
  balance: number
  rng: () => number
  wallet: ToyWalletPort
}): CardsView {
  if (!acquireLock(input.userId)) throw new ToyPlayError(409, '這一局還在結算，請稍等。')
  try {
    if (input.action === 'claim') return _claim(input)
    if (input.action === 'guess') return _guess(input)
    return _start(input)
  } finally {
    releaseLock(input.userId)
  }
}

function _start(input: { userId: string; bet?: number; balance: number; rng: () => number; wallet: ToyWalletPort }): CardsView {
  const bet = Number(input.bet)
  if (!isValidBet(bet)) throw new ToyPlayError(400, '注額必須是 1 以上的整數。')
  if (readPool(input.userId)) throw new ToyPlayError(400, '還有未結束的玩具，不能另開一局。')
  const dealt = drawRank(freshDeck(), input.rng)
  let balance = input.balance
  try {
    balance = input.wallet.debit(input.userId, bet, `紙牌下注 ${bet}`)
  } catch {
    throw new ToyPlayError(400, '餘額不足，無法扣款。')
  }
  writePool({
    userId: input.userId,
    unclaimed: 0,
    gameKey: GAME_KEY,
    bet,
    claimed: false,
    meta: { rank: dealt.rank, deck: dealt.deck, streak: 0 }
  })
  return {
    status: 'result',
    rank: dealt.rank,
    nextRank: null,
    choice: null,
    correct: null,
    multiplier: 0,
    streak: 0,
    unclaimed: 0,
    reward: 0,
    balance,
    claimed: false,
    canGuess: true,
    canClaim: false,
    gameKey: GAME_KEY
  }
}

function _guess(input: { userId: string; choice?: CardChoice; balance: number; rng: () => number }): CardsView {
  const pool = readPool(input.userId)
  const meta = readMeta(input.userId)
  const choice = input.choice
  if (!pool || !meta || pool.gameKey !== GAME_KEY) throw new ToyPlayError(400, '請先開始紙牌。')
  if (meta.streak >= CARD_STREAK.length) throw new ToyPlayError(400, '已達連勝上限，請先領取。')
  if (pool.unclaimed >= applyMultiplier(pool.bet, TOY_MAX_POT_MULTIPLIER)) {
    throw new ToyPlayError(400, '彩池已到上限，請先領取。')
  }
  if (choice !== 'high' && choice !== 'low' && choice !== 'same') throw new ToyPlayError(400, '請選大、小或相同。')

  const dealt = drawRank(meta.deck, input.rng)
  const correct = judgeCard(meta.rank, dealt.rank, choice)
  if (!correct) {
    clearPool(input.userId)
    return {
      status: 'result',
      rank: meta.rank,
      nextRank: dealt.rank,
      choice,
      correct: false,
      multiplier: 0,
      streak: 0,
      unclaimed: 0,
      reward: 0,
      balance: input.balance,
      claimed: false,
      canGuess: false,
      canClaim: false,
      gameKey: null
    }
  }

  const multiplier = cardMultiplier(meta.streak, choice)
  const basis = pool.unclaimed > 0 ? pool.unclaimed : pool.bet
  const clamped = clampPot(applyMultiplier(basis, multiplier), pool.bet)
  const streak = meta.streak + 1
  writePool({
    ...pool,
    unclaimed: clamped.pot,
    meta: { rank: dealt.rank, deck: dealt.deck, streak }
  })
  return {
    status: 'result',
    rank: meta.rank,
    nextRank: dealt.rank,
    choice,
    correct: true,
    multiplier,
    streak,
    unclaimed: clamped.pot,
    reward: 0,
    balance: input.balance,
    claimed: false,
    canGuess: streak < CARD_STREAK.length && !clamped.capped,
    canClaim: true,
    gameKey: GAME_KEY
  }
}

function _claim(input: { userId: string; balance: number; wallet: ToyWalletPort }): CardsView {
  const pool = readPool(input.userId)
  if (!pool || pool.gameKey !== GAME_KEY || pool.unclaimed <= 0) throw new ToyPlayError(400, '現在不能領取。')
  if (pool.claimed) throw new ToyPlayError(400, '這一局已經領過。')
  pool.claimed = true
  writePool(pool)
  let balance = input.balance
  try {
    balance = input.wallet.credit(input.userId, pool.unclaimed, `紙牌領取 ${pool.unclaimed}`)
  } catch (error) {
    pool.claimed = false
    writePool(pool)
    throw error
  }
  const credited = pool.unclaimed
  clearPool(input.userId)
  return {
    status: 'result',
    rank: null,
    nextRank: null,
    choice: null,
    correct: true,
    multiplier: 0,
    streak: 0,
    unclaimed: 0,
    reward: credited,
    balance,
    claimed: true,
    canGuess: false,
    canClaim: false,
    gameKey: null
  }
}
