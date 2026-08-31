import type {
  AuthRecord,
  SessionRecord,
  LotteryGame,
  LotteryStore
} from '../types/storage'
import { encodePasswordBcjs } from '../utils/encrypt'
import { compareSync } from 'bcryptjs'
import UsersClass from './users'
import ConfigClass from './game/lottery/bg/config'
import LhcOfClass from './game/lottery/bg/6hcOf'
import LhcCdClass from './game/lottery/bg/6hcCd'
import K3CdClass from './game/lottery/bg/k3Cd'
import K3OfClass from './game/lottery/bg/k3Of'
import Pk10CdClass from './game/lottery/bg/pk10Cd'
import Pk10OfClass from './game/lottery/bg/pk10Of'
import SscCdClass from './game/lottery/bg/sscCd'
import SscOfClass from './game/lottery/bg/sscOf'
import X5CdClass from './game/lottery/bg/x5Cd'
import X5OfClass from './game/lottery/bg/x5Of'
import EggsClass from './game/lottery/bg/eggs'
import Kl10Class from './game/lottery/bg/kl10'
import Kl8Class from './game/lottery/bg/kl8'
import Fc3dClass from './game/lottery/bg/fc3d'
import Pl3Class from './game/lottery/bg/pl3'
import RetroSnakeClass from './game/retro/snake'
import RetroRacingClass from './game/retro/racing'
import RetroTetriminosClass from './game/retro/tetriminos'
import RetroMatch3RushClass from './game/retro/match3rush'
import RetroMatch3ClassicClass from './game/retro/match3classic'
import RetroMinesweeperClass from './game/retro/minesweeper'
import RetroPongClass from './game/retro/pong'
import RetroRunnerClass from './game/retro/runner'
import RetroSpaceShooterClass from './game/retro/spaceShooter'
import RetroPacManClass from './game/retro/pacMan'
import RetroSpaceInvadersClass from './game/retro/spaceInvaders'
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
  static games: Record<string, any> = {}
  static lotteryStore: LotteryStore = createDefaultLotteryStore()
  static lottery = {
    orders: {}
  }
  /** 復古遊戲（snake/racing/tetriminos）獨立於彩票的 games 註冊表，避免跟 LOTTERY_BASE 型別耦合 */
  static retroGames: { instances: Record<string, any>; history: Record<string, any> } = {
    instances: {},
    history: {}
  }

  static handle = {
    configInit: () => {
      new ConfigClass()
      // console.log('config.init.success', Storage.config.LHC)
      console.log('SUCCESS ---BASE>config.init')
    },
    usersInit: () => {
      const _accounts = Object.keys(this.account)
      _accounts.forEach(account => {
        this.users[account] = new UsersClass(account)
      })
      // console.log('account.init.success')
      console.log('SUCCESS ---BASE>account.init')
    },
    gamesInit: () => {
      new LhcCdClass()
      new LhcOfClass()
      // 快3：K3-CD 與 K3-OF 共用開獎號與彩池（見 k3Shared.ts），
      // 先 new 的那個產生當日期表，後 new 的直接沿用同一份
      new K3CdClass()
      new K3OfClass()
      // PK10：PK10-CD 與 PK10-OF 共用開獎號與彩池（見 pk10Shared.ts），
      // 與快3 一樣，先 new 的那個產生當日期表，後 new 的直接沿用同一份
      new Pk10CdClass()
      new Pk10OfClass()
      // 時時彩：SSC-CD 與 SSC-OF 共用開獎號與彩池（見 sscShared.ts），
      // 與快3 / PK10 一樣，先 new 的那個產生當日期表，後 new 的直接沿用同一份
      new SscCdClass()
      new SscOfClass()
      // 11選5：X5-CD 與 X5-OF 共用開獎號與彩池（見 x5Shared.ts），
      // 與快3 / PK10 / 時時彩一樣，先 new 的那個產生當日期表，後 new 的直接沿用同一份
      new X5CdClass()
      new X5OfClass()
      // PC蛋蛋：只有信用盤（來源本身無官方盤），不需要跟其他實例共用開獎號
      new EggsClass()
      // 快樂十分：同 PC蛋蛋，只有信用盤，自己持有期表
      new Kl10Class()
      // 快樂8：同 PC蛋蛋／快樂十分，只有信用盤，自己持有期表
      new Kl8Class()
      // 福彩3D：只有官方盤（來源本身無信用盤、無彩池），自己持有期表，不與其他實例共用開獎號
      new Fc3dClass()
      // 排列3：玩法結構與福彩3D相同（官方盤單盤口、無彩池），獨立彩種、自己持有期表
      new Pl3Class()
      // console.log('games.init.success', Storage.games)
      console.log('SUCCESS ---BASE>games.init')
    },
    gamesInitRetro: () => {
      new RetroSnakeClass()
      new RetroRacingClass()
      new RetroTetriminosClass()
      new RetroMatch3RushClass()
      new RetroMatch3ClassicClass()
      new RetroPongClass()
      new RetroRunnerClass()
      new RetroSpaceShooterClass()
      new RetroMinesweeperClass()
      new RetroPacManClass()
      new RetroSpaceInvadersClass()
      console.log('SUCCESS ---BASE>retroGames.init')
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
    this.handle.gamesInitRetro()
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