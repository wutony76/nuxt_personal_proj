import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/**
 * PK10官方盤：爆池狀態
 *
 * ⚠️ 爆池與 /pk10-of/current 回的 `pool` 是**兩個不同的池**：
 *   current.pool  —— PK10-CD 與 PK10-OF 共用的彩池，官方盤的彩池分頁分層在吃
 *   本支          —— 爆池，兩個盤口共吃一池，開出爆池條件那期一次發放
 * ⚠️ 本支與 /pk10-cd/jackpot 回的是**同一份**（狀態在 pk10Shared.ts）。
 */
type PK10OfService = {
  get: {
    creditJackpot?: () => Record<string, unknown>
  }
}

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
  const game = Storage.games[LOTTERY['PK10-OF'].key] as PK10OfService | undefined
  return game?.get?.creditJackpot?.() ?? EMPTY
})
