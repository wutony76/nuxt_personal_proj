import { isDbEnabled, getDb } from 'serv/services/db'
import { poolAuditReseed, poolAuditOverpay } from 'serv/services/db/schema'
import type { PoolReseedEvent, FloorOverpayEvent } from './poolAudit'

/**
 * 查詢 `pool_audit_reseed`/`pool_audit_overpay` 的完整歷史（全量快照同步，不裁剪，見
 * migrate-wallet-and-reports-postgres/design.md 第 4b 節）。DB 未啟用時回傳空陣列——查詢
 * 路徑會自動退回「只看記憶體」的既有行為。
 */
export async function queryArchivedPoolAuditEvents(): Promise<{ reseed: PoolReseedEvent[]; overpay: FloorOverpayEvent[] }> {
  if (!isDbEnabled()) return { reseed: [], overpay: [] }
  const db = getDb()
  const [reseedRows, overpayRows] = await Promise.all([
    db.select().from(poolAuditReseed),
    db.select().from(poolAuditOverpay)
  ])
  return {
    reseed: reseedRows.map((row) => ({
      id: row.id,
      lotteryKey: row.lotteryKey,
      issue: row.issue,
      before: Number(row.before),
      after: Number(row.after),
      timestamp: row.happenedAt.getTime()
    })),
    overpay: overpayRows.map((row) => ({
      id: row.id,
      lotteryKey: row.lotteryKey,
      issue: row.issue,
      overpay: Number(row.overpay),
      timestamp: row.happenedAt.getTime()
    }))
  }
}
