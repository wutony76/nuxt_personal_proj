import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/**
 * 快3信用盤：爆池狀態
 *
 * ⚠️ 與 /k3-cd/current 回的 `pool` 是**兩個不同的池**：
 *   current.pool  —— K3-CD 與 K3-OF 共用的彩池，官方盤三軍分層在吃
 *   本支          —— 信用盤自己的爆池，開出設定的爆池號那期一次發放
 */
type K3CdService = {
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
  const game = Storage.games[LOTTERY['K3-CD'].key] as K3CdService | undefined
  return game?.get?.creditJackpot?.() ?? EMPTY
})
