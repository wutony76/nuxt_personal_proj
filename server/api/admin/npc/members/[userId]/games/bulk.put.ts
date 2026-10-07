import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'
import type { NpcGameCategory } from 'serv/services/admin/modules/npcAutoPlay'

type Body = {
  category?: unknown
  allowed?: unknown
}

/**
 * 後台：快捷選擇——把某個 NPC 在某分類底下所有已支援的遊戲一次全選或全不選
 * @returns 該 NPC 目前完整的 allowedGames 清單（composite key）
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const userId = getRouterParam(event, 'userId') ?? ''
  const body = await readBody<Body>(event)
  const category = body?.category as NpcGameCategory
  if (typeof body?.allowed !== 'boolean') {
    throw createError({ statusCode: 400, message: 'allowed 必須是 boolean。' })
  }

  const allowedGames = await Storage.manager.admin.npcAutoPlay.setMemberGamesBulk(userId, category, body.allowed)
  return { allowedGames }
})
