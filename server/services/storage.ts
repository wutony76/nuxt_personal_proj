import type {
  AuthRecord,
  SessionRecord,
  LotteryGame,
  LotteryStore
} from '../types/storage'
import { encodePasswordBcjs } from '../utils/encrypt'
import { compareSync } from 'bcryptjs'
import UsersClass from './users'
import ConfigClass from './config'
import LhcOfClass from './lottery6hcOf'
import LhcCdClass from './lottery6hcCd'
import { LOTTERY } from '~/config/constants'

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
  constructor() { }

  static initialized = false
  static config: Record<string, Record<string, unknown>> = {}
  static account: Record<string, AuthRecord> = {}
  static sessions = new Map<string, SessionRecord>()
  static users: Record<string, unknown> = {}
  static games: Record<string, unknown> = {}
  static lotteryStore: LotteryStore = createDefaultLotteryStore()
  static lottery = {
    orders: {}
  }

  static handle = {
    configInit: () => {
      new ConfigClass()
      console.log('config.init.success', Storage.config.LHC)
    },
    usersInit: () => {
      const _accounts = Object.keys(this.account)
      _accounts.forEach(account => {
        this.users[account] = new UsersClass(account)
      })
      console.log('account.init.success')
    },
    gamesInit: () => {
      new LhcCdClass()
      new LhcOfClass()
      console.log('games.init.success', Storage.games)
    }
  }
  static init() {
    if (this.initialized) return
    // DTAT.INIT.
    this.account = {
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
    this.users = {
      // 'U0xA000001': new UsersClass('U0xA000001'),
    }

    this.sessions = new Map<string, SessionRecord>()
    this.lotteryStore = createDefaultLotteryStore()
    this.initialized = true


    this.handle.configInit()
    this.handle.usersInit()
    this.handle.gamesInit()
  }

  static get = {
    account: (): Readonly<Record<string, AuthRecord>> => {
      this.init()
      return this.account
    },
    sessions: (): Map<string, SessionRecord> => {
      this.init()
      return this.sessions
    },
    lotteryStore: (): LotteryStore => {
      this.init()
      return this.lotteryStore
    },
    user: (userId: string) => {
      this.init()
      const user = this.users[userId]
      if (!user) new UsersClass(userId)
      return this.users[userId]
    },
    lotteryPlay: (lotteryId: number = LOTTERY['6HC'].id, num: number = -1) => {
      if (num === -1) return null
      const _id = `${lotteryId}${String(num).padStart(3, '0')}`
      if (lotteryId === LOTTERY['6HC'].id) {
        return this.config.LHC?.[_id] ?? null
      }
      return this.config[String(lotteryId)]?.[_id] ?? null
    }
  }
}