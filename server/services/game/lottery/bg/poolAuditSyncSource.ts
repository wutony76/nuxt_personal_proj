import { Storage } from 'serv/services/storage'
import { registerSyncSource } from 'serv/services/sync'
import type { PoolReseedEvent, FloorOverpayEvent } from './poolAudit'

/**
 * 註冊 `pool_audit_reseed`/`pool_audit_overpay` 的 SyncSource：全量快照，不裁剪
 * （記憶體本身已有 2000→1800 的上限保護，DB 化後可保留完整歷史，見 design.md 第 5 節）。
 */
export function registerPoolAuditSyncSources(): void {
  registerSyncSource({
    table: 'pool_audit_reseed',
    primaryKey: ['id'],
    snapshot: () => {
      const audit = (Storage.lottery as { poolAudit?: { reseed: PoolReseedEvent[] } }).poolAudit
      return (audit?.reseed ?? []).map((event) => ({
        id: event.id,
        lottery_key: event.lotteryKey,
        issue: event.issue,
        before: event.before,
        after: event.after,
        happened_at: new Date(event.timestamp)
      }))
    }
  })

  registerSyncSource({
    table: 'pool_audit_overpay',
    primaryKey: ['id'],
    snapshot: () => {
      const audit = (Storage.lottery as { poolAudit?: { overpay: FloorOverpayEvent[] } }).poolAudit
      return (audit?.overpay ?? []).map((event) => ({
        id: event.id,
        lottery_key: event.lotteryKey,
        issue: event.issue,
        overpay: event.overpay,
        happened_at: new Date(event.timestamp)
      }))
    }
  })
}
