import { sessionController } from '../../../services/auth'
import { getRetroLeaderboard } from '../../../services/game/retro/leaderboard'

/** 遊戲中心用：各遊戲全站最高分一筆；混排依該遊戲最近遊玩時間取 5 */
export default defineEventHandler((event) => {
  sessionController.require(event)
  return { entries: getRetroLeaderboard() }
})
