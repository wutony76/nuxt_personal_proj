import { fetchTaiwanLotteryLastNumber } from '../../services/game/lottery/tw/taiwanLotteryApi'

export default defineEventHandler(async () => {
  return fetchTaiwanLotteryLastNumber()
})
