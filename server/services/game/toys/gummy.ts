import { GUMMY_COLORS } from './catalog.ts'
import { CARD_STREAK } from './cards.ts'
import { ToyPlayError, type ToyWalletPort } from './luckyDraw.ts'
import { acquireLock, clearPool, readPool, releaseLock, writePool } from './pool.ts'
import { pickWeighted } from './random.ts'
import { applyMultiplier, clampPot, isValidBet } from './reward.ts'
import { resolveFate, resolveWithFate } from './difficulty.ts'

const GAME_KEY = 'gummy'
export type GummyColor = (typeof GUMMY_COLORS)[number]['id']

export type GummyMeta = {
  streak: number
  history: GummyColor[]
}

export type GummyView = {
  status: 'idle' | 'result'
  color: GummyColor | null
  guess: GummyColor | null
  correct: boolean | null
  history: GummyColor[]
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
 * @param streak 已連勝次數
 * @returns 紙牌同一張連勝倍率
 */
export function gummyMultiplier(streak: number): number {
  return CARD_STREAK[Math.min(streak, CARD_STREAK.length - 1)] ?? 1
}

function readMeta(userId: string): GummyMeta | null {
  const pool = readPool(userId)
  if (!pool || pool.gameKey !== GAME_KEY || !pool.meta) return null
  return pool.meta as GummyMeta
}

function recent(history: GummyColor[]): GummyColor[] {
  return history.slice(-4)
}

/**
 * @param userId 帳號 id
 * @param balance 目前 F 幣
 * @returns 橡皮糖畫面
 */
export function snapshotGummy(userId: string, balance: number): GummyView {
  const pool = readPool(userId)
  const meta = readMeta(userId)
  const owned = pool?.gameKey === GAME_KEY
  return {
    status: owned ? 'result' : 'idle',
    color: null,
    guess: null,
    correct: null,
    history: recent(meta?.history ?? []),
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
 * @param input.action 開局、猜色或領取
 * @returns 已抽出顏色的畫面
 */
export function playGummy(input: {
  userId: string
  action: 'start' | 'guess' | 'claim'
  bet?: number
  guess?: GummyColor
  balance: number
  rng: () => number
  wallet: ToyWalletPort
  difficulty?: number
}): GummyView {
  if (!acquireLock(input.userId)) throw new ToyPlayError(409, '這一局還在結算，請稍等。')
  try {
    if (input.action === 'claim') return _claim(input)
    if (input.action === 'guess') return _guess(input)
    return _start(input)
  } finally {
    releaseLock(input.userId)
  }
}

function _start(input: { userId: string; bet?: number; balance: number; wallet: ToyWalletPort }): GummyView {
  const bet = Number(input.bet)
  if (!isValidBet(bet)) throw new ToyPlayError(400, '注額必須是 1 以上的整數。')
  if (readPool(input.userId)) throw new ToyPlayError(400, '還有未結束的玩具，不能另開一局。')
  let balance = input.balance
  try {
    balance = input.wallet.debit(input.userId, bet, `橡皮糖下注 ${bet}`)
  } catch {
    throw new ToyPlayError(400, '餘額不足，無法扣款。')
  }
  writePool({
    userId: input.userId,
    unclaimed: 0,
    gameKey: GAME_KEY,
    bet,
    claimed: false,
    meta: { streak: 0, history: [] }
  })
  return {
    status: 'result',
    color: null,
    guess: null,
    correct: null,
    history: [],
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

function _guess(input: {
  userId: string
  guess?: GummyColor
  balance: number
  rng: () => number
  difficulty?: number
}): GummyView {
  const pool = readPool(input.userId)
  const meta = readMeta(input.userId)
  const guess = input.guess
  if (!pool || !meta || pool.gameKey !== GAME_KEY) throw new ToyPlayError(400, '請先開始橡皮糖。')
  if (meta.streak >= CARD_STREAK.length) throw new ToyPlayError(400, '已達連勝上限，請先領取。')
  if (!GUMMY_COLORS.some((item) => item.id === guess)) throw new ToyPlayError(400, '請選一個顏色。')

  const targetWin = resolveFate(input.difficulty ?? 1, input.rng)
  const { drawn, win: correct } = resolveWithFate(targetWin, () => {
    const d = pickWeighted([...GUMMY_COLORS], input.rng)
    return { win: d.id === guess, drawn: d }
  })
  const history = recent([...meta.history, drawn.id])
  if (!correct) {
    clearPool(input.userId)
    return {
      status: 'result',
      color: drawn.id,
      guess,
      correct: false,
      history,
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

  const multiplier = gummyMultiplier(meta.streak)
  const basis = pool.unclaimed > 0 ? pool.unclaimed : pool.bet
  const clamped = clampPot(applyMultiplier(basis, multiplier), pool.bet)
  const streak = meta.streak + 1
  writePool({
    ...pool,
    unclaimed: clamped.pot,
    meta: { streak, history }
  })
  return {
    status: 'result',
    color: drawn.id,
    guess,
    correct: true,
    history,
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

function _claim(input: { userId: string; balance: number; wallet: ToyWalletPort }): GummyView {
  const pool = readPool(input.userId)
  const meta = readMeta(input.userId)
  if (!pool || pool.gameKey !== GAME_KEY || pool.unclaimed <= 0) throw new ToyPlayError(400, '現在不能領取。')
  if (pool.claimed) throw new ToyPlayError(400, '這一局已經領過。')
  pool.claimed = true
  writePool(pool)
  let balance = input.balance
  try {
    balance = input.wallet.credit(input.userId, pool.unclaimed, `橡皮糖領取 ${pool.unclaimed}`)
  } catch (error) {
    pool.claimed = false
    writePool(pool)
    throw error
  }
  const credited = pool.unclaimed
  clearPool(input.userId)
  return {
    status: 'result',
    color: null,
    guess: null,
    correct: true,
    history: recent(meta?.history ?? []),
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
