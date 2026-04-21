import { Storage } from '../services/storage'

export type { LotteryGame, BetRecord, LotteryStore } from '../types/storage'

export const getMockLotteryStore = () => {
  return Storage.get.lotteryStore()
}
