import { Storage } from 'serv/services/storage'
import type { RetroHistoryRecordRow } from 'serv/services/game/retro/history'
import { queryArchivedRetroHistoryForUser } from 'serv/services/game/retro/historyReportQuery'
import { queryArchivedWalletChangesForUser } from 'serv/services/walletReportQuery'

type RetroGameInstance = {
  get?: { history?: (userId: string) => RetroHistoryRecordRow[] }
}

export type AdminGameBalanceChange = {
  id: string
  gameKey: string
  type: string
  amount: number
  note: string
  createdAt: number
}

export type AdminGameHistoryResult = {
  records: RetroHistoryRecordRow[]
  balanceChanges: AdminGameBalanceChange[]
}

/**
 * 後台：查任一玩家跨所有復古遊戲的遊戲紀錄，加上對應的 coin 兌換明細（見 design.md Decision 5；
 * DB 合併查詢見 migrate-wallet-and-reports-postgres/design.md 第 4a 節）。
 */
export const adminGameHistoryService = {
  /**
   * 記憶體（近期，每人每遊戲上限 50 筆）+ DB（`retro_game_history`/`wallet_balance_changes`
   * 全量快照，完整歷史）合併查詢，以 id 去重（記憶體版本優先）。
   * @param userId 帳號 id
   * @returns 依時間新到舊的遊戲紀錄與 coin 兌換明細
   */
  list: async (userId: string): Promise<AdminGameHistoryResult> => {
    const instances = Storage.retroGames.instances as Record<string, RetroGameInstance>
    const memoryRecords = Object.values(instances).flatMap((game) => game.get?.history?.(userId) ?? [])
    const archivedRecords = await queryArchivedRetroHistoryForUser(userId)
    const recordIds = new Set(memoryRecords.map((r) => r.id))
    const records = [...memoryRecords, ...archivedRecords.filter((r) => !recordIds.has(r.id))]
    records.sort((a, b) => b.playedAt.localeCompare(a.playedAt))

    const user = Storage.get.user(userId) as { record?: { balanceChanges?: Array<{ id: string; type: string; amount: number; note: string; createdAt: number }> } } | undefined
    const memoryChanges = (user?.record?.balanceChanges ?? []).filter((c) => c.type === 'game-reward')
    const archivedChanges = (await queryArchivedWalletChangesForUser(userId))
      .filter((c) => c.source === 'record' && c.type === 'game-reward')
    const changeIds = new Set(memoryChanges.map((c) => c.id))
    const balanceChanges: AdminGameBalanceChange[] = [
      ...memoryChanges,
      ...archivedChanges.filter((c) => !changeIds.has(c.id))
    ]
      .map((c) => ({
        id: c.id,
        gameKey: (c.note.match(/^(.*?)\s*遊戲結算/)?.[1]) ?? '',
        type: c.type,
        amount: c.amount,
        note: c.note,
        createdAt: c.createdAt
      }))
      .sort((a, b) => b.createdAt - a.createdAt)

    return { records, balanceChanges }
  }
}
