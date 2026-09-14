import { fetchTaiwanLotteryPrize } from '../../services/game/lottery/tw/taiwanLotteryApi'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const gameCode = Number(query.gameCode)
  const period = String(query.period || '')

  if (!gameCode || !period) {
    throw createError({ statusCode: 400, message: '缺少 gameCode 或 period' })
  }

  return fetchTaiwanLotteryPrize(gameCode, period)
})
