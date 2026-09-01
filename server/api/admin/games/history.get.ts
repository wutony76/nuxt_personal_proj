import { sessionController } from '../../../services/auth'
import { Storage } from '../../../services/storage'
import type { RetroHistoryRecordRow } from '../../../services/game/retro/history'

type RetroGameInstance = {
  get?: { history?: (userId: string) => RetroHistoryRecordRow[] }
}

type BalanceChange = {
  id: string
  gameKey: string
  type: string
  amount: number
  note: string
  createdAt: number
}

/** 查任一玩家跨所有復古遊戲的遊戲紀錄，加上對應的 coin 兌換明細，見 design.md Decision 5 */
export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)

  const query = getQuery(event)
  const userId = String(query.userId ?? '').trim()
  if (!userId) {
    throw createError({ statusCode: 400, message: '請提供 userId。' })
  }

  const instances = Storage.retroGames.instances as Record<string, RetroGameInstance>
  const records = Object.values(instances).flatMap((game) => game.get?.history?.(userId) ?? [])
  records.sort((a, b) => b.playedAt.localeCompare(a.playedAt))

  const user = Storage.get.user(userId) as { record?: { balanceChanges?: Array<{ id: string; type: string; amount: number; note: string; createdAt: number }> } } | undefined
  const balanceChanges: BalanceChange[] = (user?.record?.balanceChanges ?? [])
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
})
