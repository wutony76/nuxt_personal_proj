import { loginHistoryService } from 'serv/services/loginHistory'
import { registerSyncSource } from 'serv/services/sync'

/**
 * 註冊 `login_history` 的 SyncSource：全量快照，不裁剪（記憶體本身已有「每人 100 筆」
 * 上限保護，這裡只是確保被裁掉之前有機會先落地到 DB，見
 * openspec/changes/migrate-login-history-postgres/design.md 第 2 節）。
 */
export function registerLoginHistorySyncSource(): void {
  registerSyncSource({
    table: 'login_history',
    primaryKey: ['id'],
    snapshot: () => {
      return loginHistoryService.snapshotAll().map((entry) => ({
        id: entry.id,
        user_id: entry.userId,
        email: entry.email,
        ip: entry.ip,
        user_agent: entry.userAgent,
        created_at: new Date(entry.createdAt)
      }))
    }
  })
}
