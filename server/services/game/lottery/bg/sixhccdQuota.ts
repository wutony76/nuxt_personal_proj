import { isDbEnabled, getDb } from 'serv/services/db'
import {
  sixhccdQuotaSettings,
  sixhccdMemberQuota,
  sixhccdTabIssueSpent,
  sixhccdIssueSpent
} from 'serv/services/db/schema'
import { sql, eq } from 'drizzle-orm'

/**
 * 6hc-cd 限額 P2：跨分頁單期總上限（全站預設 + 玩家覆寫）+ 兩個 write-through counter
 * （取代既有 per-tab 單期檢查與新的跨分頁檢查原本要現場重算記憶體的做法，修正「重啟後
 * 當期已用額度歸零」），見 openspec/changes/add-6hccd-quota-p2/design.md。
 */

let _globalCrossTabIssueMax = 0
const _memberCrossTabIssueMax = new Map<string, number>()
/** key `${userId}:${tabId}:${issue}` */
const _tabIssueSpentCache = new Map<string, number>()
/** key `${userId}:${issue}` */
const _issueSpentCache = new Map<string, number>()

function _tabKey(userId: string, tabId: number, issue: string): string {
  return `${userId}:${tabId}:${issue}`
}

function _issueKey(userId: string, issue: string): string {
  return `${userId}:${issue}`
}

export const sixhccdQuotaService = {
  /** 玩家覆寫優先，沒有覆寫就用全站預設；`0` = 不限 */
  crossTabIssueMaxOf: (userId: string): number => {
    return _memberCrossTabIssueMax.get(userId) ?? _globalCrossTabIssueMax
  },

  /** 取代 `orders.get.issueTabCoin()` 的記憶體重算，讀 write-through counter 快取 */
  tabIssueSpentOf: (userId: string, tabId: number, issue: string): number => {
    return _tabIssueSpentCache.get(_tabKey(userId, tabId, issue)) ?? 0
  },

  /** 取代 `orders.get.members.issue()` 的記憶體重算，讀 write-through counter 快取 */
  issueSpentOf: (userId: string, issue: string): number => {
    return _issueSpentCache.get(_issueKey(userId, issue)) ?? 0
  },

  /**
   * 下注成功後呼叫：累加「每分頁單期」與「跨分頁單期」兩個 counter。DB 寫入
   * fire-and-forget（見 design.md 第 6c 節，不擋下注流程），記憶體快取由 DB 的
   * `.returning()` 原子累加結果回填；DB 停用時直接在記憶體累加。
   * @param userId 玩家
   * @param issue 期別
   * @param perTab 本次送單各分頁的投注額（tabId -> coin）
   */
  addSpent: (userId: string, issue: string, perTab: Map<number, number>): void => {
    let totalNew = 0
    for (const [tabId, coin] of perTab.entries()) {
      totalNew += coin
      if (isDbEnabled()) {
        void getDb().insert(sixhccdTabIssueSpent)
          .values({ userId, tabId, issue, amount: String(coin) })
          .onConflictDoUpdate({
            target: [sixhccdTabIssueSpent.userId, sixhccdTabIssueSpent.tabId, sixhccdTabIssueSpent.issue],
            set: { amount: sql`${sixhccdTabIssueSpent.amount} + ${coin}`, updatedAt: new Date() }
          })
          .returning({ amount: sixhccdTabIssueSpent.amount })
          .then(([row]) => {
            if (row) _tabIssueSpentCache.set(_tabKey(userId, tabId, issue), Number(row.amount))
          })
          .catch((error) => {
            console.error('sixhccdQuota.addSpent.tab.failed', userId, tabId, issue, error)
          })
      } else {
        const key = _tabKey(userId, tabId, issue)
        _tabIssueSpentCache.set(key, (_tabIssueSpentCache.get(key) ?? 0) + coin)
      }
    }

    if (isDbEnabled()) {
      void getDb().insert(sixhccdIssueSpent)
        .values({ userId, issue, amount: String(totalNew) })
        .onConflictDoUpdate({
          target: [sixhccdIssueSpent.userId, sixhccdIssueSpent.issue],
          set: { amount: sql`${sixhccdIssueSpent.amount} + ${totalNew}`, updatedAt: new Date() }
        })
        .returning({ amount: sixhccdIssueSpent.amount })
        .then(([row]) => {
          if (row) _issueSpentCache.set(_issueKey(userId, issue), Number(row.amount))
        })
        .catch((error) => {
          console.error('sixhccdQuota.addSpent.issue.failed', userId, issue, error)
        })
    } else {
      const key = _issueKey(userId, issue)
      _issueSpentCache.set(key, (_issueSpentCache.get(key) ?? 0) + totalNew)
    }
  },

  /** 後台：設定全站預設跨分頁單期總上限（write-through） */
  setGlobalCrossTabIssueMax: async (value: number): Promise<number> => {
    if (!Number.isFinite(value) || value < 0) {
      throw createError({ statusCode: 400, message: '上限必須是不小於 0 的數字（0 = 不限）。' })
    }
    if (isDbEnabled()) {
      await getDb().insert(sixhccdQuotaSettings)
        .values({ id: 'default', crossTabIssueMax: String(value) })
        .onConflictDoUpdate({ target: sixhccdQuotaSettings.id, set: { crossTabIssueMax: String(value) } })
    }
    _globalCrossTabIssueMax = value
    return _globalCrossTabIssueMax
  },

  /** 後台：設定（或清除，`value=null`）玩家個別跨分頁單期總上限覆寫 */
  setMemberCrossTabIssueMax: async (userId: string, value: number | null): Promise<number | null> => {
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      throw createError({ statusCode: 400, message: '上限必須是不小於 0 的數字（0 = 不限），或傳 null 清除覆寫。' })
    }
    if (isDbEnabled()) {
      const db = getDb()
      if (value === null) {
        await db.delete(sixhccdMemberQuota).where(eq(sixhccdMemberQuota.userId, userId))
      } else {
        await db.insert(sixhccdMemberQuota)
          .values({ userId, crossTabIssueMax: String(value) })
          .onConflictDoUpdate({
            target: sixhccdMemberQuota.userId,
            set: { crossTabIssueMax: String(value), updatedAt: new Date() }
          })
      }
    }
    if (value === null) _memberCrossTabIssueMax.delete(userId)
    else _memberCrossTabIssueMax.set(userId, value)
    return value
  },

  /** 後台：讀取全站預設值 + 全部玩家覆寫清單 */
  getSettings: (): {
    globalCrossTabIssueMax: number
    memberOverrides: Array<{ userId: string; crossTabIssueMax: number }>
  } => {
    return {
      globalCrossTabIssueMax: _globalCrossTabIssueMax,
      memberOverrides: [..._memberCrossTabIssueMax.entries()]
        .map(([userId, crossTabIssueMax]) => ({ userId, crossTabIssueMax }))
    }
  },

  /**
   * 開機回填：設定（全站預設+玩家覆寫）沒有種子分支（空 DB 天然對應「不限」的記憶體預設值，
   * 比照 role_game_perms 既有模式）；兩個 counter 表全量回填（比照既有表「全表回填」做法，
   * 見 design.md 第 6d 節）。
   */
  rehydrateFromDb: async (): Promise<void> => {
    if (!isDbEnabled()) return
    const db = getDb()
    const [settingsRow, memberRows, tabIssueRows, issueRows] = await Promise.all([
      db.select().from(sixhccdQuotaSettings).where(eq(sixhccdQuotaSettings.id, 'default')).then((rows) => rows[0]),
      db.select().from(sixhccdMemberQuota),
      db.select().from(sixhccdTabIssueSpent),
      db.select().from(sixhccdIssueSpent)
    ])

    if (settingsRow) _globalCrossTabIssueMax = Number(settingsRow.crossTabIssueMax)

    _memberCrossTabIssueMax.clear()
    for (const row of memberRows) _memberCrossTabIssueMax.set(row.userId, Number(row.crossTabIssueMax))

    _tabIssueSpentCache.clear()
    for (const row of tabIssueRows) {
      _tabIssueSpentCache.set(_tabKey(row.userId, row.tabId, row.issue), Number(row.amount))
    }

    _issueSpentCache.clear()
    for (const row of issueRows) {
      _issueSpentCache.set(_issueKey(row.userId, row.issue), Number(row.amount))
    }
  }
}
