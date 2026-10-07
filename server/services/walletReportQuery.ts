import { isDbEnabled, getDb } from 'serv/services/db'
import { walletBalanceChanges, twPayoutEvents } from 'serv/services/db/schema'
import { eq, and, gte, lt } from 'drizzle-orm'

/**
 * 跟記憶體裡 `WalletBalanceChange` 同形狀的最小子集，供查詢路徑把 DB 裡的完整歷史（`record`
 * 等 22 個來源皆有同步，見 migrate-wallet-and-reports-postgres/design.md 第 2 節）接回來，
 * 跟記憶體裡的近期資料合併。DB 未啟用時回傳空陣列——查詢路徑會自動退回「只看記憶體」的既有行為。
 */
export type ArchivedWalletChangeRow = {
  source: string
  id: string
  userId: string
  issue: string
  type: string
  amount: number
  before: number
  after: number
  createdAt: number
  note: string
}

function _monthRange(month: string): { start: Date; end: Date } {
  const start = new Date(`${month}-01T00:00:00.000Z`)
  const end = new Date(start)
  end.setUTCMonth(end.getUTCMonth() + 1)
  return { start, end }
}

function _toArchivedWalletChangeRow(row: typeof walletBalanceChanges.$inferSelect): ArchivedWalletChangeRow {
  return {
    source: row.source,
    id: row.id,
    userId: row.userId,
    issue: row.issue,
    type: row.type,
    amount: Number(row.amount),
    before: Number(row.before),
    after: Number(row.after),
    createdAt: row.createdAt.getTime(),
    note: row.note
  }
}

/** 查詢指定會員在 `wallet_balance_changes` 的完整歷史（見 gameHistory.ts 的 Area A 用途）。 */
export async function queryArchivedWalletChangesForUser(userId: string): Promise<ArchivedWalletChangeRow[]> {
  if (!isDbEnabled()) return []
  const rows = await getDb().select().from(walletBalanceChanges).where(eq(walletBalanceChanges.userId, userId))
  return rows.map(_toArchivedWalletChangeRow)
}

/** 查詢指定月份（依 `created_at`）的 `wallet_balance_changes`（見 fcoin-summary 的 Area C 用途）。 */
export async function queryArchivedWalletChangesForMonth(month: string): Promise<ArchivedWalletChangeRow[]> {
  if (!isDbEnabled()) return []
  const { start, end } = _monthRange(month)
  const rows = await getDb().select().from(walletBalanceChanges).where(and(
    gte(walletBalanceChanges.createdAt, start),
    lt(walletBalanceChanges.createdAt, end)
  ))
  return rows.map(_toArchivedWalletChangeRow)
}

export type ArchivedTwPayoutRow = {
  source: string
  orderId: string
  userId: string
  issue: string
  amount: number
  createdAt: number
}

/** 查詢指定月份（依 `created_at`）的台彩中獎事件（見 tw-lottery-payout 的 Area D 用途）。 */
export async function queryArchivedTwPayoutsForMonth(month: string): Promise<ArchivedTwPayoutRow[]> {
  if (!isDbEnabled()) return []
  const { start, end } = _monthRange(month)
  const rows = await getDb().select().from(twPayoutEvents).where(and(
    gte(twPayoutEvents.createdAt, start),
    lt(twPayoutEvents.createdAt, end)
  ))
  return rows.map((row) => ({
    source: row.source,
    orderId: row.orderId,
    userId: row.userId,
    issue: row.issue,
    amount: Number(row.amount),
    createdAt: row.createdAt.getTime()
  }))
}
