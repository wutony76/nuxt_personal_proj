import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/**
 * PC蛋蛋：爆池狀態
 *
 * ⚠️ 與 k3 / pk10 / ssc 不同，PC蛋蛋沒有官方盤、也沒有共用彩池 ——
 *    這是它唯一的一個池，所以 /eggs/current 不需要（也沒有）`pool` 欄位。
 */
type EggsService = {
  get: {
    creditJackpot?: () => Record<string, unknown>
  }
}

/** 服務尚未初始化時的兜底：回空值而不是丟 500，看板不必為此開特例 */
const EMPTY = {
  issue: '',
  currentIssueJackpot: 0,
  carryJackpot: 0,
  distributable: 0,
  rakeRatio: 0,
  payoutRatio: 0,
  minPool: 0,
  hitLabel: '',
  hitRate: 0,
  lastHit: null
}

export default defineEventHandler(() => {
  const game = Storage.games[LOTTERY.EGGS.key] as EggsService | undefined
  return game?.get?.creditJackpot?.() ?? EMPTY
})
