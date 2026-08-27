import { Storage } from '../../storage'
import RetroHistoryClass, { type RetroHistoryRecordRow } from './history'

type RetroUserLike = {
  coin?: number
  record?: {
    balanceChanges: Array<Record<string, unknown>>
    betHistory: Array<Record<string, unknown>>
    claimableIssues: Array<Record<string, unknown>>
    updatedAt: number
  }
}

export type SettleRewardResult = {
  coinReward: number
  coinCapped: boolean
  newCoinBalance: number
}

export type RecordInput = {
  score: number
  level?: number
  meta?: Record<string, unknown>
}

export type RecordResult = SettleRewardResult & {
  record: RetroHistoryRecordRow
}

type RetroGameOptions = {
  key: string
  name: string
  /** 得分 → coin 的固定線性倍率（方案 A），依各遊戲分數量級各自校準 */
  coinRate: number
  /** 單局 coin 上限，防止極端一局核發過量 */
  coinCapPerRun: number
  /** 每人每日 coin 上限，防止掛機刷分無限印幣 */
  coinDailyCap: number
}

/**
 * 復古遊戲（retro）共用基底類別，比照 LOTTERY_BASE 的「共用基底 + 每款遊戲一個服務檔」分層方式，
 * 但不繼承 LOTTERY_BASE（那支類別的期數/開獎循環邏輯是彩票專屬，這裡完全用不到）。
 */
export default class RETRO_GAME_BASE {
  key: string
  name: string
  coinRate: number
  coinCapPerRun: number
  coinDailyCap: number

  constructor(opts: RetroGameOptions) {
    this.key = opts.key
    this.name = opts.name
    this.coinRate = opts.coinRate
    this.coinCapPerRun = opts.coinCapPerRun
    this.coinDailyCap = opts.coinDailyCap
    Storage.retroGames.instances[this.key] = this
  }

  static formatDateKey(date: Date): string {
    const y = date.getFullYear().toString()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}${m}${d}`
  }

  _get = {
    history: (): RetroHistoryClass => {
      const map = Storage.retroGames.history as Record<string, RetroHistoryClass | undefined>
      if (!map[this.key]) map[this.key] = new RetroHistoryClass(this.key)
      return map[this.key] as RetroHistoryClass
    },
    user: (userId: string): RetroUserLike => Storage.get.user(userId) as RetroUserLike
  }

  /** 各遊戲子類別覆寫：回傳分數合理性上限（超過視為異常，寫入紀錄與換算 coin 前先夾住） */
  maxReasonableScore(): number {
    return Number.POSITIVE_INFINITY
  }

  validateScore(score: number): number {
    const safe = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0
    return Math.min(safe, this.maxReasonableScore())
  }

  get = {
    history: (userId: string): RetroHistoryRecordRow[] => this._get.history().get.byUser(userId)
  }

  actions = {
    /** 寫入一筆遊戲紀錄，並在同一次呼叫內完成 coin 結算（比照 6hc bet.post.ts 一次做完扣款+建單） */
    record: (userId: string, input: RecordInput): RecordResult => {
      const safeScore = this.validateScore(input.score)
      const record = this._get.history().add.record(userId, {
        gameKey: this.key,
        gameName: this.name,
        score: safeScore,
        ...(input.level !== undefined ? { level: input.level } : {}),
        ...(input.meta ? { meta: input.meta } : {})
      })
      const reward = this.actions.settleReward(userId, safeScore)
      return { record, ...reward }
    },

    settleReward: (userId: string, score: number): SettleRewardResult => {
      const history = this._get.history()
      const todayKey = RETRO_GAME_BASE.formatDateKey(new Date())
      const grantedToday = history.get.dailyGranted(userId, todayKey)
      const remainDaily = Math.max(0, this.coinDailyCap - grantedToday)
      const rawReward = Math.floor(score * this.coinRate)
      const cappedByRun = Math.min(rawReward, this.coinCapPerRun)
      const coinReward = Math.max(0, Math.min(cappedByRun, remainDaily))
      const coinCapped = coinReward < cappedByRun

      const user = this._get.user(userId)
      if (coinReward > 0) {
        const before = Number(user.coin ?? 0)
        const after = before + coinReward
        user.coin = after
        if (!user.record) {
          user.record = { balanceChanges: [], betHistory: [], claimableIssues: [], updatedAt: Date.now() }
        }
        user.record.balanceChanges.push({
          id: `game-reward-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          issue: '',
          type: 'game-reward',
          amount: coinReward,
          before,
          after,
          createdAt: Date.now(),
          note: `${this.name} 遊戲結算 +${coinReward} coin`
        })
        history.add.dailyGrant(userId, todayKey, coinReward)
      }

      return {
        coinReward,
        coinCapped,
        newCoinBalance: Number(user.coin ?? 0)
      }
    },

    clear: (userId: string) => {
      this._get.history().clear(userId)
    }
  }
}
