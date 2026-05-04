import { api, type Lottery6hcOfCurrent, type Lottery6hcRoadPlay, type LotteryBetPayload, type LotteryBetResponse, type LotteryState } from '~/services/api'

export class Lottery6hcOfficialService {
  fetchCurrentInfo() {
    return api.lottery.current6hcOf() as Promise<Lottery6hcOfCurrent>
  }

  fetchRoadPlays() {
    return api.lottery.road6hcOf() as Promise<{ plays: Lottery6hcRoadPlay[] }>
  }

  fetchWalletState() {
    return api.lottery.userInfo() as Promise<LotteryState>
  }

  submitBet(payload: LotteryBetPayload) {
    return api.lottery.bet(payload) as Promise<LotteryBetResponse>
  }

  fetchServerTime() {
    return api.system.servTime() as Promise<{ serverTime: number }>
  }
}
