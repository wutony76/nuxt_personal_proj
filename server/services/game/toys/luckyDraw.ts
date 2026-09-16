import { LUCKY_DRAW_CELLS, LUCKY_DRAW_REWARDS, TOY_MAX_POT_MULTIPLIER } from './catalog.ts'
import { acquireLock, clearPool, hasOpenRound, readPool, releaseLock, writePool } from './pool.ts'
import { pickWeighted } from './random.ts'
import { applyMultiplier, clampPot, isValidBet } from './reward.ts'

export class ToyPlayError extends Error {
  statusCode: number

  /**
   * @param statusCode HTTP 狀態
   * @param message 給畫面的錯誤
   */
  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
  }
}

export type ToyWalletPort = {
  /**
   * @param userId 帳號 id
   * @param amount 正整數
   * @param note 稽核備註
   * @returns 扣完後的 F 幣
   */
  debit: (userId: string, amount: number, note: string) => number
  /**
   * @param userId 帳號 id
   * @param amount 正整數
   * @param note 稽核備註
   * @returns 入帳後的 F 幣
   */
  credit: (userId: string, amount: number, note: string) => number
}

export type LuckyDrawResult = {
  rewardId: string
  label: string
  multiplier: number
  cellIndex: number
}

export type LuckyDrawView = {
  status: 'idle' | 'result'
  result: LuckyDrawResult | null
  unclaimed: number
  reward: number
  balance: number
  claimed: boolean
  canContinue: boolean
  canClaim: boolean
  gameKey: string | null
}

export type LuckyDrawAction = 'start' | 'continue' | 'claim'

const GAME_KEY = 'lucky-draw'

/**
 * @param userId 帳號 id
 * @param balance 目前 F 幣
 * @returns 給頁面的彩池快照
 */
export function snapshotLuckyDraw(userId: string, balance: number): LuckyDrawView {
  const pool = readPool(userId)
  const unclaimed = pool?.unclaimed ?? 0
  const owned = pool?.gameKey === GAME_KEY
  return {
    status: unclaimed > 0 ? 'result' : 'idle',
    result: null,
    unclaimed,
    reward: 0,
    balance,
    claimed: false,
    canContinue: owned && unclaimed > 0,
    canClaim: owned && unclaimed > 0,
    gameKey: pool?.gameKey ?? null
  }
}

/**
 * @param input.userId 帳號 id
 * @param input.action 開局、繼續或領取
 * @param input.bet 開局注額
 * @param input.cellIndex 翻開的格子，0–11
 * @param input.balance 目前 F 幣，領取前用來回傳
 * @param input.rng 唯一隨機點
 * @param input.wallet F 幣扣款與入帳
 * @returns 結算後的畫面狀態
 */
export function playLuckyDraw(input: {
  userId: string
  action: LuckyDrawAction
  bet?: number
  cellIndex?: number
  balance: number
  rng: () => number
  wallet: ToyWalletPort
}): LuckyDrawView {
  if (!acquireLock(input.userId)) {
    throw new ToyPlayError(409, '這一局還在結算，請稍等。')
  }
  try {
    if (input.action === 'claim') return _claim(input)
    if (input.action === 'continue') return _continue(input)
    return _start(input)
  } finally {
    releaseLock(input.userId)
  }
}

function _start(input: {
  userId: string
  bet?: number
  cellIndex?: number
  balance: number
  rng: () => number
  wallet: ToyWalletPort
}): LuckyDrawView {
  const bet = Number(input.bet)
  const cellIndex = Number(input.cellIndex)
  if (!isValidBet(bet)) throw new ToyPlayError(400, '注額必須是 1 以上的整數。')
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= LUCKY_DRAW_CELLS) {
    throw new ToyPlayError(400, '請選一格。')
  }
  if (hasOpenRound(input.userId)) throw new ToyPlayError(400, '還有未結束的玩具，不能另開一局。')

  const reward = pickWeighted(LUCKY_DRAW_REWARDS, input.rng)
  const raw = applyMultiplier(bet, reward.multiplier)
  const clamped = clampPot(raw, bet, TOY_MAX_POT_MULTIPLIER)
  let balance = input.balance
  try {
    balance = input.wallet.debit(input.userId, bet, `抽抽樂下注 ${bet}`)
  } catch {
    throw new ToyPlayError(400, '餘額不足，無法扣款。')
  }

  if (clamped.pot <= 0) {
    clearPool(input.userId)
    return {
      status: 'result',
      result: { rewardId: reward.id, label: reward.label, multiplier: reward.multiplier, cellIndex },
      unclaimed: 0,
      reward: 0,
      balance,
      claimed: false,
      canContinue: false,
      canClaim: false,
      gameKey: null
    }
  }

  writePool({
    userId: input.userId,
    unclaimed: clamped.pot,
    gameKey: GAME_KEY,
    bet,
    claimed: false
  })
  return {
    status: 'result',
    result: { rewardId: reward.id, label: reward.label, multiplier: reward.multiplier, cellIndex },
    unclaimed: clamped.pot,
    reward: 0,
    balance,
    claimed: false,
    canContinue: !clamped.capped,
    canClaim: true,
    gameKey: GAME_KEY
  }
}

function _continue(input: {
  userId: string
  cellIndex?: number
  balance: number
  rng: () => number
  wallet: ToyWalletPort
}): LuckyDrawView {
  const pool = readPool(input.userId)
  const cellIndex = Number(input.cellIndex)
  if (!pool || pool.unclaimed <= 0 || pool.gameKey !== GAME_KEY) {
    throw new ToyPlayError(400, '現在不能繼續抽。')
  }
  if (pool.claimed) throw new ToyPlayError(400, '這一局已經領過。')
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= LUCKY_DRAW_CELLS) {
    throw new ToyPlayError(400, '請選一格。')
  }
  const cap = applyMultiplier(pool.bet, TOY_MAX_POT_MULTIPLIER)
  if (pool.unclaimed >= cap) throw new ToyPlayError(400, '彩池已到上限，請先領取。')

  const reward = pickWeighted(LUCKY_DRAW_REWARDS, input.rng)
  if (reward.multiplier <= 0) {
    clearPool(input.userId)
    return {
      status: 'result',
      result: { rewardId: reward.id, label: reward.label, multiplier: 0, cellIndex },
      unclaimed: 0,
      reward: 0,
      balance: input.balance,
      claimed: false,
      canContinue: false,
      canClaim: false,
      gameKey: null
    }
  }

  const next = clampPot(applyMultiplier(pool.unclaimed, reward.multiplier), pool.bet, TOY_MAX_POT_MULTIPLIER)
  writePool({ ...pool, unclaimed: next.pot, claimed: false })
  return {
    status: 'result',
    result: { rewardId: reward.id, label: reward.label, multiplier: reward.multiplier, cellIndex },
    unclaimed: next.pot,
    reward: 0,
    balance: input.balance,
    claimed: false,
    canContinue: !next.capped,
    canClaim: true,
    gameKey: GAME_KEY
  }
}

function _claim(input: { userId: string; balance: number; wallet: ToyWalletPort }): LuckyDrawView {
  const pool = readPool(input.userId)
  if (!pool || pool.unclaimed <= 0 || pool.gameKey !== GAME_KEY) {
    throw new ToyPlayError(400, '現在不能領取。')
  }
  if (pool.claimed) throw new ToyPlayError(400, '這一局已經領過。')

  pool.claimed = true
  writePool(pool)
  let balance = input.balance
  try {
    balance = input.wallet.credit(input.userId, pool.unclaimed, `抽抽樂領取 ${pool.unclaimed}`)
  } catch (error) {
    pool.claimed = false
    writePool(pool)
    throw error
  }
  const credited = pool.unclaimed
  clearPool(input.userId)
  return {
    status: 'result',
    result: null,
    unclaimed: 0,
    reward: credited,
    balance,
    claimed: true,
    canContinue: false,
    canClaim: false,
    gameKey: null
  }
}
