import { Storage } from 'serv/services/storage'
import { isDbEnabled, getDb } from 'serv/services/db'
import { retroGameHistory } from 'serv/services/db/schema'
import { eq } from 'drizzle-orm'
import type { RetroHistoryRecordRow } from './history'

/**
 * 查詢指定會員在 `retro_game_history` 的完整歷史（全量快照同步，不裁剪，見
 * migrate-wallet-and-reports-postgres/design.md 第 4a 節）。DB 未啟用時回傳空陣列——查詢
 * 路徑會自動退回「只看記憶體」的既有行為。`game_name` 沒有同步進 DB（見
 * historySyncSource.ts），回放時用目前的遊戲實例名稱補上，跟 members.get.ts 既有做法一致。
 */
export async function queryArchivedRetroHistoryForUser(userId: string): Promise<RetroHistoryRecordRow[]> {
  if (!isDbEnabled()) return []
  const rows = await getDb().select().from(retroGameHistory).where(eq(retroGameHistory.userId, userId))
  const instances = Storage.retroGames.instances as Record<string, { name?: string } | undefined>
  return rows.map((row) => ({
    id: row.id,
    gameKey: row.gameKey,
    gameName: instances[row.gameKey]?.name ?? row.gameKey,
    score: row.score,
    level: row.level ?? undefined,
    meta: row.meta ? (row.meta as Record<string, unknown>) : undefined,
    playedAt: row.playedAt.toISOString()
  }))
}
