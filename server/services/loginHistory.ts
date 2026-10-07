import type { H3Event } from 'h3'
import type { AuthUser } from '../types/storage'

export type LoginHistoryEntry = {
  id: string
  userId: string
  email: string
  ip: string
  userAgent: string
  createdAt: number
}

const byUser = new Map<string, LoginHistoryEntry[]>()
const MAX_ROWS = 100

/**
 * 登入成功稽核紀錄（in-memory，重啟後清空）。
 */
export const loginHistoryService = {
  /**
   * @param event H3 請求（取 IP、User-Agent）
   * @param user 登入使用者
   */
  record: (event: H3Event, user: AuthUser): void => {
    const list = byUser.get(user.id) ?? []
    list.push({
      id: globalThis.crypto.randomUUID(),
      userId: user.id,
      email: user.email,
      ip: getRequestIP(event, { xForwardedFor: true }) ?? '',
      userAgent: getHeader(event, 'user-agent') ?? '',
      createdAt: Date.now()
    })
    if (list.length > MAX_ROWS) {
      byUser.set(user.id, list.slice(-MAX_ROWS))
      return
    }
    byUser.set(user.id, list)
  },

  /**
   * @param userId 帳號 id
   * @returns 依時間新到舊的登入紀錄
   */
  list: (userId: string): LoginHistoryEntry[] => {
    return (byUser.get(userId) ?? []).toSorted((a, b) => b.createdAt - a.createdAt).slice(0, MAX_ROWS)
  },

  /**
   * 供 `loginHistorySyncSource.ts` 全量快照同步使用，見
   * openspec/changes/migrate-login-history-postgres/design.md。
   */
  snapshotAll: (): LoginHistoryEntry[] => {
    return Array.from(byUser.values()).flat()
  },

  /**
   * 刪除會員時呼叫（見 openspec/changes/add-delete-member/design.md 第 1b 節）。純記憶體操作，
   * DB 的 `login_history` 既有列刻意保留當歷史稽核，不受影響。
   * @param userId 被刪除的帳號
   */
  remove: (userId: string): void => {
    byUser.delete(userId)
  }
}
