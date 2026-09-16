import NP from 'number-precision'
import { TOY_MAX_POT_MULTIPLIER } from './catalog.ts'

/**
 * @param amount 注額或目前未領金額
 * @param multiplier 倍率
 * @returns 四捨五入後的整數金額
 */
export function applyMultiplier(amount: number, multiplier: number): number {
  return NP.round(NP.times(amount, multiplier), 0)
}

/**
 * @param pot 連乘後的未領金額
 * @param bet 開局注額
 * @param maxMultiplier 上限倍率，預設 500
 * @returns 夾住後的未領金額，以及是否已到頂
 */
export function clampPot(pot: number, bet: number, maxMultiplier = TOY_MAX_POT_MULTIPLIER): { pot: number; capped: boolean } {
  const cap = applyMultiplier(bet, maxMultiplier)
  if (pot >= cap) return { pot: cap, capped: true }
  return { pot, capped: false }
}

/**
 * @param bet 注額
 * @returns 是否為大於等於 1 的整數
 */
export function isValidBet(bet: number): boolean {
  return Number.isInteger(bet) && bet >= 1
}
