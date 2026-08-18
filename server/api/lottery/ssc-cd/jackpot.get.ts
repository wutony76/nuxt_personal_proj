import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/**
 * 時時彩信用盤：爆池狀態
 *
 * ⚠️ 與 /ssc-cd/current 回的 `pool` 是**兩個不同的池**：
 *   current.pool  —— SSC-CD 與 SSC-OF 共用的彩池，官方盤後三直選分層在吃
 *   本支          —— 信用盤自己的爆池，開出「後三豹子」那期一次發放
 */
type SscCdService = {
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
  const game = Storage.games[LOTTERY['SSC-CD'].key] as SscCdService | undefined
  return game?.get?.creditJackpot?.() ?? EMPTY
})
