import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/**
 * PC蛋蛋：彩池玩法（選號）狀態
 *
 * ⚠️ 跟 jackpot.get.ts 是兩個完全獨立的池——這支是彩池玩法的池底/抽水/滾存，
 *    jackpot.get.ts 是既有爆池（開豹子觸發），兩者互不影響。
 */
type EggsService = {
  get: {
    poolState?: () => Record<string, unknown>
  }
}

/** 服務尚未初始化時的兜底：回空值而不是丟 500，看板不必為此開特例 */
const EMPTY = {
  issue: '',
  base: 0,
  carry: 0,
  issuePool: 0,
  distributable: 0,
  prizeTiers: []
}

export default defineEventHandler(() => {
  const game = Storage.games[LOTTERY.EGGS.key] as EggsService | undefined
  return game?.get?.poolState?.() ?? EMPTY
})
