import { Storage } from './storage'

type BalanceChangeType = 'bet' | 'claim'

type UserBalanceChange = {
  id: string
  issue: string
  type: BalanceChangeType
  amount: number
  before: number
  after: number
  createdAt: number
  note: string
}

type UserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  betCode: string[]
  openCode: string[]
  matchCount: number
  winStatus: 'pending' | 'win' | 'lose'
  winAmount: number
}

type UserClaimableIssue = {
  issue: string
  amount: number
  openCode: string[]
  createdAt: number
}

type UserRecord = {
  balanceChanges: UserBalanceChange[]
  betHistory: UserBetHistory[]
  claimableIssues: UserClaimableIssue[]
  updatedAt: number
}

export default class Users {
  userId: string
  coin: number
  record: UserRecord

  constructor(userId: string) {
    this.userId = userId
    this.coin = 100000
    this.record = {
      balanceChanges: [],
      betHistory: [],
      claimableIssues: [],
      updatedAt: Date.now()
    }
    this.init()
  }

  init() {
    Storage.users[this.userId] = this
  }
}