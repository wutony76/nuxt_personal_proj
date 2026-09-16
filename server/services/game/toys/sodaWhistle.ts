import NP from 'number-precision'
import { SODA_BUST_RATES, SODA_PRIZES } from './catalog.ts'
import { ToyPlayError, type ToyWalletPort } from './luckyDraw.ts'
import { acquireLock, clearPool, readPool, releaseLock, writePool } from './pool.ts'
import { clampPot, isValidBet } from './reward.ts'

const GAME_KEY = 'soda-whistle'

export type SodaMeta = {
  step: number
}

export type SodaView = {
  status: 'idle' | 'result'
  busted: boolean | null
  step: number
  prize: number
  unclaimed: number
  reward: number
  balance: number
  claimed: boolean
  canContinue: boolean
  canClaim: boolean
  gameKey: string | null
}

/**
 * @param bet 注額
 * @param step 第幾次成功，從 0 起算
 * @returns 該次成功後的未領金額
 */
export function sodaPrize(bet: number, step: number): number {
  const sample = SODA_PRIZES[step]
  if (sample == null) return 0
  return NP.round(NP.divide(NP.times(bet, sample), 100), 0)
}

/**
 * @param step 即將吹的次數，從 0 起算
 * @param roll 0–1 的隨機值
 * @returns 是否爆掉。動畫不得改判
 */
export function isSodaBust(step: number, roll: number): boolean {
  const rate = SODA_BUST_RATES[step]
  if (rate == null) return true
  return roll < rate
}

function readMeta(userId: string): SodaMeta | null {
  const pool = readPool(userId)
  if (!pool || pool.gameKey !== GAME_KEY || !pool.meta) return null
  return pool.meta as SodaMeta
}

/**
 * @param userId 帳號 id
 * @param balance 目前 F 幣
 * @returns 汽水笛畫面
 */
export function snapshotSoda(userId: string, balance: number): SodaView {
  const pool = readPool(userId)
  const meta = readMeta(userId)
  const owned = pool?.gameKey === GAME_KEY
  const step = meta?.step ?? 0
  return {
    status: owned ? 'result' : 'idle',
    busted: null,
    step,
    prize: owned ? pool?.unclaimed ?? 0 : 0,
    unclaimed: owned ? pool?.unclaimed ?? 0 : 0,
    reward: 0,
    balance,
    claimed: false,
    canContinue: owned && step < SODA_PRIZES.length,
    canClaim: owned && (pool?.unclaimed ?? 0) > 0,
    gameKey: pool?.gameKey ?? null
  }
}

/**
 * @param input.action 開局、繼續吹或領取
 * @returns 已決定成敗的畫面
 */
export function playSoda(input: {
  userId: string
  action: 'start' | 'continue' | 'claim'
  bet?: number
  balance: number
  rng: () => number
  wallet: ToyWalletPort
}): SodaView {
  if (!acquireLock(input.userId)) throw new ToyPlayError(409, '這一局還在結算，請稍等。')
  try {
    if (input.action === 'claim') return _claim(input)
    if (input.action === 'continue') return _blow(input, false)
    return _blow(input, true)
  } finally {
    releaseLock(input.userId)
  }
}

function _blow(input: {
  userId: string
  bet?: number
  balance: number
  rng: () => number
  wallet: ToyWalletPort
}, opening: boolean): SodaView {
  const pool = readPool(input.userId)
  if (opening) {
    const bet = Number(input.bet)
    if (!isValidBet(bet)) throw new ToyPlayError(400, '注額必須是 1 以上的整數。')
    if (pool) throw new ToyPlayError(400, '還有未結束的玩具，不能另開一局。')
  } else if (!pool || pool.gameKey !== GAME_KEY) {
    throw new ToyPlayError(400, '請先開始汽水笛。')
  }

  const meta = opening ? { step: 0 } : readMeta(input.userId)
  const step = meta?.step ?? 0
  if (!opening && step >= SODA_PRIZES.length) throw new ToyPlayError(400, '已吹到最後一階，請先領取。')

  const roll = input.rng()
  const busted = isSodaBust(step, roll)
  let balance = input.balance
  let bet = opening ? Number(input.bet) : (pool?.bet ?? 0)
  if (opening) {
    try {
      balance = input.wallet.debit(input.userId, bet, `汽水笛下注 ${bet}`)
    } catch {
      throw new ToyPlayError(400, '餘額不足，無法扣款。')
    }
  }
  if (busted) {
    if (pool) clearPool(input.userId)
    return {
      status: 'result',
      busted: true,
      step,
      prize: 0,
      unclaimed: 0,
      reward: 0,
      balance,
      claimed: false,
      canContinue: false,
      canClaim: false,
      gameKey: null
    }
  }

  const prize = clampPot(sodaPrize(bet, step), bet).pot
  const nextStep = step + 1
  writePool({
    userId: input.userId,
    unclaimed: prize,
    gameKey: GAME_KEY,
    bet,
    claimed: false,
    meta: { step: nextStep }
  })
  return {
    status: 'result',
    busted: false,
    step: nextStep,
    prize,
    unclaimed: prize,
    reward: 0,
    balance,
    claimed: false,
    canContinue: nextStep < SODA_PRIZES.length,
    canClaim: prize > 0,
    gameKey: GAME_KEY
  }
}

function _claim(input: { userId: string; balance: number; wallet: ToyWalletPort }): SodaView {
  const pool = readPool(input.userId)
  if (!pool || pool.gameKey !== GAME_KEY || pool.unclaimed <= 0) throw new ToyPlayError(400, '現在不能領取。')
  if (pool.claimed) throw new ToyPlayError(400, '這一局已經領過。')
  pool.claimed = true
  writePool(pool)
  let balance = input.balance
  try {
    balance = input.wallet.credit(input.userId, pool.unclaimed, `汽水笛領取 ${pool.unclaimed}`)
  } catch (error) {
    pool.claimed = false
    writePool(pool)
    throw error
  }
  const credited = pool.unclaimed
  clearPool(input.userId)
  return {
    status: 'result',
    busted: false,
    step: 0,
    prize: credited,
    unclaimed: 0,
    reward: credited,
    balance,
    claimed: true,
    canContinue: false,
    canClaim: false,
    gameKey: null
  }
}
