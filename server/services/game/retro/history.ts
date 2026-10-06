import { Storage } from 'serv/services/storage'
import { isDbEnabled, getDb } from 'serv/services/db'
import { retroDailyGrants } from 'serv/services/db/schema'
import { sql } from 'drizzle-orm'

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
    /**
     * write-through（非批次同步，見 migrate-game-history-postgres/design.md 第 4 節決策記錄）：
     * DB 啟用時用 DB 的原子 `amount = amount + $coin` 當真相，寫入成功後才把回傳的最新值套用到
     * 記憶體，避免併發核發時記憶體用本地計算值覆蓋掉彼此的結果。
     */
    dailyGrant: async (userId: string, dateKey: string, coin: number): Promise<void> => {
      if (isDbEnabled()) {
        const db = getDb()
        const [row] = await db.insert(retroDailyGrants)
          .values({ userId, gameKey: this.gameKey, dateKey, amount: coin })
          .onConflictDoUpdate({
            target: [retroDailyGrants.userId, retroDailyGrants.gameKey, retroDailyGrants.dateKey],
            set: { amount: sql`${retroDailyGrants.amount} + ${coin}`, updatedAt: new Date() }
          })
          .returning({ amount: retroDailyGrants.amount })
        const userMap = this.dailyGrants[userId] ?? {}
        userMap[dateKey] = row.amount
        this.dailyGrants[userId] = userMap
        return
      }
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

/**
 * 開機回填（見 migrate-game-history-postgres/design.md 第 4 節）：只回填「今天」的計數器，
 * 因為 dailyGrants 的唯一用途是當日配額檢查，更早的日期對 runtime 邏輯沒有意義。DB 未啟用時
 * 整段略過，退回現有「重啟即歸零」的行為（跟遷移前一致）。
 * @param todayKey 'YYYYMMDD'（見 RETRO_GAME_BASE.formatDateKey）
 */
export async function rehydrateTodayDailyGrantsFromDb(todayKey: string): Promise<void> {
  if (!isDbEnabled()) return
  const db = getDb()
  const rows = await db.select().from(retroDailyGrants).where(sql`${retroDailyGrants.dateKey} = ${todayKey}`)

  const historyMap = Storage.retroGames.history as Record<string, RetroHistoryClass | undefined>
  for (const row of rows) {
    if (!historyMap[row.gameKey]) historyMap[row.gameKey] = new RetroHistoryClass(row.gameKey)
    const instance = historyMap[row.gameKey]!
    const userMap = instance.dailyGrants[row.userId] ?? {}
    userMap[row.dateKey] = row.amount
    instance.dailyGrants[row.userId] = userMap
  }
}
