import { getMockLotteryStore } from '../../utils/mockLotteryStore'

export default defineEventHandler(() => {
  const store = getMockLotteryStore()
  const totalBetAmount = store.bets.reduce((sum, bet) => sum + Number(bet.amount || 0), 0)
  return {
    balance: store.balance,
    recentBets: store.bets.slice(0, 10),
    totalBetAmount,
    // TODO: waiting issue dimension in bet record; keep safe default for now.
    currentIssueBetAmount: 0
  }
})
