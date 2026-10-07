import { Storage } from 'serv/services/storage'
import { registerSyncSource } from 'serv/services/sync'

type BalanceChangeLike = {
  id: string
  issue: string
  type: string
  amount: number
  before: number
  after: number
  createdAt: number
  note: string
}

type BetHistoryRowLike = {
  orderId: string
  issue: string
  betTime: number
  winStatus: 'pending' | 'win' | 'lose'
  winAmount: number
}

type RecordLike = { balanceChanges?: BalanceChangeLike[]; betHistory?: BetHistoryRowLike[] }

/**
 * 22 個 *Record 欄位名稱（見 server/services/users.ts 的 UsersClass 與各彩種檔案的
 * ensureUserRecord()），見 openspec/changes/migrate-wallet-and-reports-postgres/design.md
 * 第 2 節。`record` 是錢包／六合彩信用盤／官方盤／復古遊戲獎勵四方共用的既有慣例。
 */
const RECORD_SOURCES = [
  'record', 'k3Record', 'k3OfRecord', 'pk10Record', 'pk10OfRecord', 'x5Record', 'x5OfRecord',
  'sscRecord', 'sscOfRecord', 'fc3dRecord', 'pl3Record', 'kl8Record', 'kl10Record', 'eggsRecord',
  'dltRecord', 'superlottoRecord', 'd539Record', 'm649Record', 'm539Record', 'p3Record',
  'p4Record', 'bingoRecord'
] as const

/** 8 款台彩玩法，betHistory 裡才有 winStatus/winAmount，見 design.md「Area D 的額外發現」。 */
const TW_RECORD_SOURCES = [
  'dltRecord', 'superlottoRecord', 'd539Record', 'm649Record', 'm539Record', 'p3Record',
  'p4Record', 'bingoRecord'
] as const

/**
 * 註冊 F幣相關的三個 SyncSource：
 * - `wallet_coin`：批次快照目前餘額（不是 write-through，見 design.md 第 1 節決策）
 * - `wallet_balance_changes`：全量快照，不裁剪（DB 保留永久完整歷史，比記憶體 5000→4000
 *   上限更完整，不回填記憶體，比照 retro_game_history/login_history 既有 precedent）
 * - `tw_payout_events`：全量快照，只收 winStatus='win' 的列，不碰 8 款 TW 玩法既有結算邏輯
 *
 * 完全不觸碰 23 款遊戲裡 46 處 coin 賦值、25 處 balanceChanges push 的既有程式碼，見
 * proposal.md「為什麼不是重寫這 71 個呼叫點」。
 */
export function registerWalletSyncSources(): void {
  registerSyncSource({
    table: 'wallet_coin',
    primaryKey: ['user_id'],
    snapshot: () => {
      const accounts = Storage.get.account()
      return Object.keys(accounts).map((userId) => ({
        user_id: userId,
        coin: String((Storage.get.user(userId) as { coin?: number })?.coin ?? 0)
      }))
    }
  })

  registerSyncSource({
    table: 'wallet_balance_changes',
    primaryKey: ['source', 'id'],
    snapshot: () => {
      const rows: Record<string, unknown>[] = []
      const accounts = Storage.get.account()
      for (const userId of Object.keys(accounts)) {
        const user = Storage.get.user(userId) as Record<string, RecordLike | undefined>
        for (const source of RECORD_SOURCES) {
          for (const change of user[source]?.balanceChanges ?? []) {
            rows.push({
              source,
              id: change.id,
              user_id: userId,
              issue: change.issue,
              type: change.type,
              amount: String(change.amount),
              before: String(change.before),
              after: String(change.after),
              created_at: new Date(change.createdAt),
              note: change.note
            })
          }
        }
      }
      return rows
    }
  })

  registerSyncSource({
    table: 'tw_payout_events',
    primaryKey: ['source', 'order_id'],
    snapshot: () => {
      const rows: Record<string, unknown>[] = []
      const accounts = Storage.get.account()
      for (const userId of Object.keys(accounts)) {
        const user = Storage.get.user(userId) as Record<string, RecordLike | undefined>
        for (const source of TW_RECORD_SOURCES) {
          for (const row of user[source]?.betHistory ?? []) {
            if (row.winStatus !== 'win') continue
            rows.push({
              source,
              order_id: row.orderId,
              user_id: userId,
              issue: row.issue,
              amount: String(row.winAmount),
              created_at: new Date(row.betTime)
            })
          }
        }
      }
      return rows
    }
  })
}
