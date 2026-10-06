import { Storage } from 'serv/services/storage'
import { registerSyncSource } from 'serv/services/sync'

/**
 * 跨 BG/TW 共用的最小結構型別（兩份 OrdersClass 定義完全獨立，見各自檔頭註解，
 * 這裡只取同步需要的欄位，不依賴任何一邊的實際 class）。
 */
type OrderRowLike = {
  issue: string
  userId: string
  coin: number
  orderId: string
  betCode: string[]
  tabId?: number
  playKey?: string
  odds?: number
  tiers?: unknown
  createdAt?: number
}
type OrdersInstanceLike = { orders: Record<string, OrderRowLike[]> }

/** 每款玩法保留在記憶體裡「不同步/不裁剪」的最近期別數（目前期 + 前一期，見 design.md 第 7 節）。 */
const PROTECTED_ISSUES_PER_GAME = 2

/**
 * 註冊 `game_orders` 的 SyncSource：增量快照（只送尚未同步過的已結算期別）+ 同步成功後
 * 裁剪記憶體（見 migrate-game-history-postgres/design.md 第 6、7 節）。
 */
export function registerGameOrdersSyncSource(): void {
  registerSyncSource({
    table: 'game_orders',
    primaryKey: ['order_id'],
    snapshot: () => {
      const rows: Record<string, unknown>[] = []
      const allOrders = Storage.lottery.orders as Record<string, OrdersInstanceLike>

      for (const [gameKey, instance] of Object.entries(allOrders)) {
        const ordersMap = instance?.orders
        if (!ordersMap) continue
        const issues = Object.keys(ordersMap).sort()
        const trimmable = issues.slice(0, Math.max(0, issues.length - PROTECTED_ISSUES_PER_GAME))
        for (const issue of trimmable) {
          for (const order of ordersMap[issue]) {
            rows.push({
              order_id: order.orderId,
              game_key: gameKey,
              issue: order.issue,
              user_id: order.userId,
              tab_id: order.tabId != null ? String(order.tabId) : null,
              play_key: order.playKey || null,
              coin: order.coin,
              bet_code: JSON.stringify(order.betCode ?? []),
              odds: order.odds ?? null,
              tiers: order.tiers ? JSON.stringify(order.tiers) : null,
              created_at: order.createdAt ? new Date(order.createdAt) : new Date()
            })
          }
        }
      }
      return rows
    },
    onSynced: (syncedRows) => {
      const toDelete = new Map<string, Set<string>>()
      for (const row of syncedRows) {
        const gameKey = String(row.game_key)
        const issue = String(row.issue)
        if (!toDelete.has(gameKey)) toDelete.set(gameKey, new Set())
        toDelete.get(gameKey)!.add(issue)
      }

      const allOrders = Storage.lottery.orders as Record<string, OrdersInstanceLike>
      for (const [gameKey, issuesToDelete] of toDelete.entries()) {
        const ordersMap = allOrders[gameKey]?.orders
        if (!ordersMap) continue
        for (const issue of issuesToDelete) delete ordersMap[issue]
      }
    }
  })
}
