import { Storage } from 'serv/services/storage'
import { registerSyncSource } from 'serv/services/sync'
import type { RetroHistoryRecordRow } from './history'

type HistoryInstanceLike = { records: Record<string, RetroHistoryRecordRow[]> }

/**
 * 註冊 `retro_game_history` 的 SyncSource：全量快照，不裁剪（記憶體本身已有「每人每遊戲 50 筆」
 * 上限保護，這裡只是確保被裁掉之前有機會先落地到 DB，見 design.md 第 7 節）。
 */
export function registerRetroHistorySyncSource(): void {
  registerSyncSource({
    table: 'retro_game_history',
    primaryKey: ['id'],
    snapshot: () => {
      const rows: Record<string, unknown>[] = []
      const allHistory = Storage.retroGames.history as Record<string, HistoryInstanceLike>

      for (const [gameKey, instance] of Object.entries(allHistory)) {
        const recordsByUser = instance?.records
        if (!recordsByUser) continue
        for (const [userId, records] of Object.entries(recordsByUser)) {
          for (const record of records) {
            rows.push({
              id: record.id,
              game_key: gameKey,
              user_id: userId,
              score: record.score,
              level: record.level ?? null,
              meta: record.meta ? JSON.stringify(record.meta) : null,
              played_at: new Date(record.playedAt)
            })
          }
        }
      }
      return rows
    }
  })
}
