import { isDbEnabled, getDb } from 'serv/services/db'
import { gameOrders } from 'serv/services/db/schema'
import { sql } from 'drizzle-orm'

/**
 * 跟記憶體裡的 `OrderRow`同形狀的最小子集，供 members.get.ts / bg-summary.get.ts 把
 * 已經被同步+裁剪掉的歷史資料接回來，跟記憶體裡還留著的「目前期 + 前一期」合併處理
 * （見 migrate-game-history-postgres/design.md 第 8 節）。
 */
export type ArchivedOrderRow = {
  gameKey: string
  issue: string
  userId: string
  coin: number
  playKey: string
  /** 僅 TW 玩法有意義（依下注時間篩月份）；BG 一律用 issue 判斷月份，這裡的值不重要 */
  createdAt: number
}

/**
 * 查詢指定月份、已歸檔到 `game_orders` 的訂單（記憶體已裁剪掉的部分）。DB 未啟用時回傳空陣列
 * ——報表會自動退回「只看記憶體」的既有行為，跟遷移前一致。
 *
 * 用一次查詢同時涵蓋 BG（issue 前 6 碼為 YYYYMM）與 TW（created_at 落在月份區間）兩種月份判斷
 * 方式：BG 的 issue 格式（YYYYMMDDhhmm）不可能符合 TW 的 created_at 區間判斷以外的巧合，反之
 * TW 的 issue（民國年序號）也不會符合 `LIKE 'YYYYMM%'`，所以兩個條件用 OR 不會互相誤判——
 * 呼叫端仍需自行用 game_key 是否屬於 TW_LOTTERY_KEYS 分流，避免「當月同步的 BG 資料」被
 * created_at 條件誤收進 TW 分支（BG 列的 created_at 是同步當下的時間，當月查詢時剛好也會符合
 * TW 的區間條件，但那是 BG 資料不是 TW 資料）。
 * @param month 'YYYY-MM'
 */
export async function queryArchivedOrdersForMonth(month: string): Promise<ArchivedOrderRow[]> {
  if (!isDbEnabled()) return []

  const monthCompact = month.replace('-', '')
  const monthStart = new Date(`${month}-01T00:00:00.000Z`)
  const monthEnd = new Date(monthStart)
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1)

  // postgres.js 透過 drizzle sql 模板組 query 時不會像 db.insert().values() 那樣依欄位型別
  // 自動編碼，Date 物件直接當參數丟進去會在底層 byteLength 檢查炸掉（見 server/services/sync.ts
  // 同一類問題的修正說明），這裡一樣先轉成 ISO 字串。
  const db = getDb()
  const rows = await db.select({
    gameKey: gameOrders.gameKey,
    issue: gameOrders.issue,
    userId: gameOrders.userId,
    coin: gameOrders.coin,
    playKey: gameOrders.playKey,
    createdAt: gameOrders.createdAt
  }).from(gameOrders).where(sql`
    ${gameOrders.issue} LIKE ${monthCompact + '%'}
    OR (${gameOrders.createdAt} >= ${monthStart.toISOString()} AND ${gameOrders.createdAt} < ${monthEnd.toISOString()})
  `)

  return rows.map((row) => ({
    gameKey: row.gameKey,
    issue: row.issue,
    userId: row.userId,
    coin: Number(row.coin),
    playKey: row.playKey ?? '',
    createdAt: row.createdAt.getTime()
  }))
}
