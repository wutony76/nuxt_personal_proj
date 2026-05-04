import Dexie, { type Table, liveQuery } from 'dexie'

export type Status = 'pending' | 'success' | 'settled'

export type Order = {
  order_id: string
  user_id: string
  issue: string
  bet_time: number
  coin: number
  bet_code: string[]
  status: Status
}

type FetchInput = {
  userId: string
  issue?: string
  limit?: number
}

type WatchInput = FetchInput & {
  onChange: (records: Order[]) => void
}

class LotteryDb extends Dexie {
  lhc_official_orders!: Table<Order, string>

  constructor() {
    super('Lottery_DB')
    this.version(1).stores({
      lhc_official_orders: '&order_id,user_id,issue,bet_time,[user_id+issue]'
    })
  }
}

let _db: LotteryDb | null = null

const _getDb = () => {
  if (!import.meta.client) return null
  if (_db) return _db
  _db = new LotteryDb()
  return _db
}

export const useLhcDb = () => {
  /**
   * Save one official order into IndexedDB.
   * @param record target order record.
   * @returns whether the save operation is successful.
   */
  const saveOrder = async (record: Order) => {
    const db = _getDb()
    if (!db) return false
    await db.lhc_official_orders.put(record)
    return true
  }

  /**
   * Fetch latest official orders from IndexedDB.
   * @param input query params for target user and issue.
   * @returns filtered order list sorted by newest bet time.
   */
  const fetchOrders = async (input: FetchInput) => {
    const db = _getDb()
    if (!db || !input.userId) return [] as Order[]

    const limit = Math.max(1, Math.trunc(input.limit ?? 20))
    const rows = await db.lhc_official_orders
      .orderBy('bet_time')
      .reverse()
      .filter((item) => item.user_id === input.userId && (!input.issue || item.issue === input.issue))
      .limit(limit)
      .toArray()

    return rows
  }

  /**
   * Keep latest official orders in sync by liveQuery.
   * @param input query params and callback.
   * @returns unsubscribe callback.
   */
  const watchOrders = (input: WatchInput) => {
    const db = _getDb()
    if (!db || !input.userId) return () => {}

    const subscription = liveQuery(() => {
      return fetchOrders({
        userId: input.userId,
        issue: input.issue,
        limit: input.limit
      })
    }).subscribe({
      next: (records) => input.onChange(records),
      error: () => input.onChange([])
    })

    return () => {
      subscription.unsubscribe()
    }
  }

  /**
   * Cleanup old official orders if total count exceeds threshold.
   * @param userId target user id.
   * @returns count of removed rows.
   */
  const cleanupOrders = async (userId: string) => {
    const db = _getDb()
    if (!db || !userId) return 0

    const total = await db.lhc_official_orders.where('user_id').equals(userId).count()
    if (total <= 5000) return 0

    const oldRows = await db.lhc_official_orders.where('user_id').equals(userId).sortBy('bet_time')
    const removedRows = oldRows.slice(0, 1000)
    if (removedRows.length === 0) return 0

    await db.lhc_official_orders.bulkDelete(removedRows.map((item) => item.order_id))
    return removedRows.length
  }

  return {
    saveOrder,
    fetchOrders,
    watchOrders,
    cleanupOrders
  }
}
