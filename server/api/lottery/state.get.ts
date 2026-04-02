import { getMockLotteryStore } from '../../utils/mockLotteryStore'

export default defineEventHandler(() => {
  const store = getMockLotteryStore()
  return {
    balance: store.balance,
    recentBets: store.bets.slice(0, 10)
  }
})
