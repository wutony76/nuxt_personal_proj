import { sessionController } from '../../../services/auth'
import { getRetroLeaderboard } from '../../../services/game/retro/leaderboard'

/** 遊戲中心用：各遊戲最新紀錄混排 5 筆（依 playedAt，非分數排序） */
export default defineEventHandler((event) => {
  sessionController.require(event)
  return { entries: getRetroLeaderboard() }
})
