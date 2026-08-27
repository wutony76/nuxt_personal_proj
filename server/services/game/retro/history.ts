import { Storage } from '../../storage'

export type RetroHistoryRecordRow = {
  id: string
  gameKey: string
  gameName: string
  score: number
  level?: number
  meta?: Record<string, unknown>
  playedAt: string
}

type AddInput = {
  gameKey: string
  gameName: string
  score: number
  level?: number
  meta?: Record<string, unknown>
}

const MAX_RECORDS_PER_USER = 50

export default class RetroHistoryClass {
  gameKey: string
  records: Record<string, RetroHistoryRecordRow[]>
  dailyGrants: Record<string, Record<string, number>>

  constructor(gameKey: string) {
    this.gameKey = gameKey
    this.records = {}
    this.dailyGrants = {}
    this.init()
  }

  init() {
    (Storage.retroGames.history as Record<string, unknown>)[this.gameKey] = this
  }

  add = {
    record: (userId: string, input: AddInput): RetroHistoryRecordRow => {
      const row: RetroHistoryRecordRow = {
        id: `${this.gameKey}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        gameKey: input.gameKey,
        gameName: input.gameName,
        score: input.score,
        ...(input.level !== undefined ? { level: input.level } : {}),
        ...(input.meta ? { meta: input.meta } : {}),
        playedAt: new Date().toISOString()
      }
      const list = this.records[userId] ?? []
      list.push(row)
      this.records[userId] = list.length > MAX_RECORDS_PER_USER ? list.slice(-MAX_RECORDS_PER_USER) : list
      return row
    },
    dailyGrant: (userId: string, dateKey: string, coin: number) => {
      const userMap = this.dailyGrants[userId] ?? {}
      userMap[dateKey] = Number(userMap[dateKey] ?? 0) + coin
      this.dailyGrants[userId] = userMap
    }
  }

  get = {
    byUser: (userId: string): RetroHistoryRecordRow[] => {
      return [...(this.records[userId] ?? [])].sort((a, b) => b.playedAt.localeCompare(a.playedAt))
    },
    dailyGranted: (userId: string, dateKey: string): number => {
      return Number(this.dailyGrants[userId]?.[dateKey] ?? 0)
    }
  }

  clear(userId: string) {
    this.records[userId] = []
  }
}
