import type {
  AuthRecord,
  SessionRecord,
  LotteryGame,
  LotteryStore
} from '../types/storage'
import { encodePasswordBcjs } from '../utils/encrypt'
import { compareSync } from 'bcryptjs'

// const PASSWORD_SALT_ROUNDS = 12

// export const createPasswordHash = (password: string): string => {
//   return hashSync(password, PASSWORD_SALT_ROUNDS)
// }

export const verifyPasswordHash = (password: string, storedHash: string): boolean => {
  return compareSync(password, storedHash)
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

const createDefaultLotteryStore = (): LotteryStore => ({
  balance: 100000,
  games: DEFAULT_GAMES,
  bets: []
})

export class Storage {
  private constructor() { }

  private static initialized = false
  private static auth: Record<string, AuthRecord> = {}

  private static authSessionStore = new Map<string, SessionRecord>()
  private static lotteryStore: LotteryStore = createDefaultLotteryStore()

  static init() {
    if (this.initialized) return
    // DTAT.INIT.
    this.auth = {
      U0xA000001: {
        id: 'U0xA000001',
        name: 'Admin',
        email: 'admin@example.com',
        passwordHash: encodePasswordBcjs('123456')
      },
      U0xA666666: {
        id: 'U0xA666666',
        name: 'HappyFayYoYo',
        email: 'hfyy@cc.cc',
        passwordHash: encodePasswordBcjs('123456')
      }
    }

    this.authSessionStore = new Map<string, SessionRecord>()
    this.lotteryStore = createDefaultLotteryStore()
    this.initialized = true
  }

  static getAuth(): Readonly<Record<string, AuthRecord>> {
    this.init()
    return this.auth
  }

  static getAuthSessionStore(): Map<string, SessionRecord> {
    this.init()
    return this.authSessionStore
  }

  static getLotteryStore(): LotteryStore {
    this.init()
    return this.lotteryStore
  }
}