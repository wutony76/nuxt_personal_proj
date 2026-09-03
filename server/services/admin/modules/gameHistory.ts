import { Storage } from 'serv/services/storage'
import type { RetroHistoryRecordRow } from 'serv/services/game/retro/history'

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
 * 後台：查任一玩家跨所有復古遊戲的遊戲紀錄，加上對應的 coin 兌換明細（見 design.md Decision 5）。
 */
export const adminGameHistoryService = {
  /**
   * @param userId 帳號 id
   * @returns 依時間新到舊的遊戲紀錄與 coin 兌換明細
   */
  list: (userId: string): AdminGameHistoryResult => {
    const instances = Storage.retroGames.instances as Record<string, RetroGameInstance>
    const records = Object.values(instances).flatMap((game) => game.get?.history?.(userId) ?? [])
    records.sort((a, b) => b.playedAt.localeCompare(a.playedAt))

    const user = Storage.get.user(userId) as { record?: { balanceChanges?: Array<{ id: string; type: string; amount: number; note: string; createdAt: number }> } } | undefined
    const balanceChanges: AdminGameBalanceChange[] = (user?.record?.balanceChanges ?? [])
      .filter((c) => c.type === 'game-reward')
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
