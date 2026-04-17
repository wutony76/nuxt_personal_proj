export type AuthUser = {
  id: string
  name: string
  email: string
}

export type AuthRecord = AuthUser & {
  passwordHash: string
}

export type SessionRecord = {
  user: AuthUser
  expiresAt: number
}

export type LotteryGame = {
  id: number
  key: string
  name: string
  category: '6hc' | 'a6' | 'bg'
  minBet: number
  maxBet: number
  defaultOdds: number
  playTypes: string[]
}

export type BetRecord = {
  id: string
  gameId: number
  gameName: string
  betType: string
  number: string
  amount: number
  odds: number
  potentialPayout: number
  createdAt: string
  status: 'accepted'
}

export type LotteryStore = {
  balance: number
  games: LotteryGame[]
  bets: BetRecord[]
}
