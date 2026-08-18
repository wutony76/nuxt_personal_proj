import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/**
 * 快3官方盤：爆池狀態
 *
 * ⚠️ 爆池與 /k3-of/current 回的 `pool` 是**兩個不同的池**：
 *   current.pool  —— K3-CD 與 K3-OF 共用的彩池，官方盤的彩池分頁分層在吃
 *   本支          —— 爆池，兩個盤口共吃一池，開出爆池條件那期一次發放
 * ⚠️ 本支與 /k3-cd/jackpot 回的是**同一份**（狀態在 k3Shared.ts）。
 */
type K3OfService = {
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
  const game = Storage.games[LOTTERY['K3-OF'].key] as K3OfService | undefined
  return game?.get?.creditJackpot?.() ?? EMPTY
})
