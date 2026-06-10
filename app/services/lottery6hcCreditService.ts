import {
  api,
  type Lottery6hcCurrent,
  type Lottery6hcRoadPlay,
  type LotteryBetPayload,
  type LotteryBetResponse,
  type LotteryState,
  type LotteryUserRecordResponse,
  type LotteryClaimOneIssueResponse,
  type LotteryOpenCodeHistoryResponse
} from '~/services/api'

import { LOTTERY } from '~/config/constants'


export const lottery_id = LOTTERY['LHC-CD'].id

export class Lottery6hcCreditService {
  fetchCurrentInfo() {
    return api.lottery.currentInfo(lottery_id) as Promise<Lottery6hcCurrent>
  }

  fetchRoadPlays() {
    return api.lottery.road6hcOf() as Promise<{ plays: Lottery6hcRoadPlay[] }>
  }

  fetchWalletState() {
    return api.lottery.userInfo() as Promise<LotteryState>
  }

  fetchOpenCodeHistory() {
    return api.lottery.openCodeHistory6hcOf() as Promise<LotteryOpenCodeHistoryResponse>
  }

  fetchUserRecord() {
    return api.lottery.userRecord6hcOf() as Promise<LotteryUserRecordResponse>
  }

  submitClaimOneIssue() {
    return api.lottery.claimOneIssue6hcOf() as Promise<LotteryClaimOneIssueResponse>
  }

  submitBet(payload: LotteryBetPayload) {
    return api.lottery.bet(payload) as Promise<LotteryBetResponse>
  }

  fetchJackpot() {
    return api.lottery.jackpot6hcOf()
  }

  fetchServerTime() {
    return api.system.servTime() as Promise<{ serverTime: number }>
  }
}
