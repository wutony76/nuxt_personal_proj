import { api, type LotteryBetPayload } from '~/services/api'

export class LotteryHallService {
  fetchGames() {
    return api.lottery.games() as Promise<{ games: any[] }>
  }

  // Keep compatibility with legacy hall page data shape.
  fetchState() {
    const lotteryApi = api.lottery as any
    if (typeof lotteryApi.state === 'function') {
      return lotteryApi.state()
    }
    return Promise.resolve({
      balance: 0,
      recentBets: []
    })
  }

  submitBet(payload: LotteryBetPayload) {
    return api.lottery.bet(payload) as Promise<any>
  }
}
