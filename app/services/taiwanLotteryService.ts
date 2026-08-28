import { api, type TaiwanLotteryPrizeResponse, type TaiwanLotteryResult } from '~/services/api'

export class TaiwanLotteryService {
  fetchLastNumber() {
    return api.taiwanLottery.lastNumber() as Promise<{ updatedAt: string; results: TaiwanLotteryResult[] }>
  }

  fetchPrizeDetail(gameCode: number, period: string) {
    return api.taiwanLottery.prize(gameCode, period) as Promise<TaiwanLotteryPrizeResponse>
  }
}
