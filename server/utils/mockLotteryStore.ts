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

type LotteryStore = {
  balance: number
  games: LotteryGame[]
  bets: BetRecord[]
}

const DEFAULT_GAMES: LotteryGame[] = [
  {
    id: 2001,
    key: '6hc',
    name: '六合彩',
    category: '6hc',
    minBet: 10,
    maxBet: 5000,
    defaultOdds: 48,
    playTypes: ['特碼', '正碼', '大小', '單雙']
  },
  {
    id: 2033,
    key: 'a6',
    name: '澳门⑥合彩(官方)',
    category: 'a6',
    minBet: 10,
    maxBet: 5000,
    defaultOdds: 49,
    playTypes: ['特碼', '正特', '連碼']
  },
  {
    id: 1213,
    key: 'k3',
    name: '快3',
    category: 'bg',
    minBet: 10,
    maxBet: 10000,
    defaultOdds: 2.5,
    playTypes: ['和值', '大小', '三軍']
  },
  {
    id: 1008,
    key: 'ssc',
    name: '時時彩',
    category: 'bg',
    minBet: 10,
    maxBet: 10000,
    defaultOdds: 9.8,
    playTypes: ['五星', '前二', '後二']
  },
  {
    id: 1405,
    key: 'pk10',
    name: 'PK10',
    category: 'bg',
    minBet: 10,
    maxBet: 10000,
    defaultOdds: 9.6,
    playTypes: ['冠軍', '亞軍', '前二']
  }
]

const createDefaultStore = (): LotteryStore => ({
  balance: 100000,
  games: DEFAULT_GAMES,
  bets: []
})

declare global {
  // eslint-disable-next-line no-var
  var __mockLotteryStore__: LotteryStore | undefined
}

export const getMockLotteryStore = (): LotteryStore => {
  if (!globalThis.__mockLotteryStore__) {
    globalThis.__mockLotteryStore__ = createDefaultStore()
  }
  return globalThis.__mockLotteryStore__
}
