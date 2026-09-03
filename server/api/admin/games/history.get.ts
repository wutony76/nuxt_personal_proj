import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/** 查任一玩家跨所有復古遊戲的遊戲紀錄，加上對應的 coin 兌換明細，見 design.md Decision 5 */
export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)

  const query = getQuery(event)
  const userId = String(query.userId ?? '').trim()
  if (!userId) {
    throw createError({ statusCode: 400, message: '請提供 userId。' })
  }

  return Storage.manager.admin.gameHistory.list(userId)
})
