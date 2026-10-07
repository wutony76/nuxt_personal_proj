import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'
import type { NpcGameCategory } from 'serv/services/admin/modules/npcAutoPlay'

type Body = {
  allowed?: unknown
}

/**
 * 後台：切換單一 NPC 會員是否允許自動遊玩某款遊戲（僅 bg／retro 分類目前支援，其餘分類一律 400）
 * @returns 該 NPC 目前完整的 allowedGames 清單（composite key）
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const userId = getRouterParam(event, 'userId') ?? ''
  const category = getRouterParam(event, 'category') as NpcGameCategory
  const key = getRouterParam(event, 'key') ?? ''
  const body = await readBody<Body>(event)
  if (typeof body?.allowed !== 'boolean') {
    throw createError({ statusCode: 400, message: 'allowed 必須是 boolean。' })
  }

  const allowedGames = await Storage.manager.admin.npcAutoPlay.setMemberGameAllowed(userId, category, key, body.allowed)
  return { allowedGames }
})
