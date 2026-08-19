import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/**
 * 11選5 信用盤：爆池狀態
 *
 * ⚠️ 與 /x5-cd/current 回的 `pool` 是**兩個不同的池**：
 *   current.pool  —— X5-CD 與 X5-OF 共用的彩池，官方盤直選類（階段 2）在吃
 *   本支          —— 爆池，開出「五球全單或全雙」那期一次發放（兩個盤口共吃）
 */
type X5CdService = {
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
  const game = Storage.games[LOTTERY['X5-CD'].key] as X5CdService | undefined
  return game?.get?.creditJackpot?.() ?? EMPTY
})
