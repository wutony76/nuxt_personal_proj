import { api, type TaiwanLotteryResult } from '~/services/api'

export class TaiwanLotteryService {
  fetchLastNumber() {
    return api.taiwanLottery.lastNumber() as Promise<{ updatedAt: string; results: TaiwanLotteryResult[] }>
  }
}
