import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/**
 * 時時彩官方盤：爆池狀態
 *
 * ⚠️ 爆池與 /ssc-of/current 回的 `pool` 是**兩個不同的池**：
 *   current.pool  —— SSC-CD 與 SSC-OF 共用的彩池，官方盤的彩池分頁分層在吃
 *   本支          —— 爆池，兩個盤口共吃一池，開出爆池條件那期一次發放
 * ⚠️ 本支與 /ssc-cd/jackpot 回的是**同一份**（狀態在 sscShared.ts）。
 */
type SSCOfService = {
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
  const game = Storage.games[LOTTERY['SSC-OF'].key] as SSCOfService | undefined
  return game?.get?.creditJackpot?.() ?? EMPTY
})
