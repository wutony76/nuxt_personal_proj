import { getMockLotteryStore } from '../../utils/mockLotteryStore'

export default defineEventHandler(() => {
  const store = getMockLotteryStore()
  return {
    games: store.games
  }
})
