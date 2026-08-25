import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/**
 * 福彩3D：全站爆池狀態
 *
 * ⚠️ 與三星直選分層彩池（pool.get.ts）是兩個完全獨立的池——這支是開豹子觸發的爆池，
 *    pool.get.ts 是三星直選自己的分層彩池，兩者互不影響。
 */
type Fc3dService = {
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
  const game = Storage.games[LOTTERY.FC3D.key] as Fc3dService | undefined
  return game?.get?.creditJackpot?.() ?? EMPTY
})
