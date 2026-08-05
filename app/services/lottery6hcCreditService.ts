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
    return api.lottery.road6hcCd() as Promise<{ plays: Lottery6hcRoadPlay[] }>
  }

  fetchWalletState() {
    return api.lottery.userInfo() as Promise<LotteryState>
  }

  fetchOpenCodeHistory() {
    return api.lottery.openCodeHistory6hcCd() as Promise<LotteryOpenCodeHistoryResponse>
  }

  fetchUserRecord() {
    return api.lottery.userRecord6hcCd() as Promise<LotteryUserRecordResponse>
  }

  submitClaimOneIssue() {
    return api.lottery.claimOneIssue6hcCd() as Promise<LotteryClaimOneIssueResponse>
  }

  submitBet(payload: LotteryBetPayload) {
    console.log('6HC-CD,submitBet', payload)
    return api.lottery.bet(payload) as Promise<LotteryBetResponse>
  }

  fetchJackpot() {
    return api.lottery.jackpot6hcCd()
  }

  fetchServerTime() {
    return api.system.servTime() as Promise<{ serverTime: number }>
  }
}
