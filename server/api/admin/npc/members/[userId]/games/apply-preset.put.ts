import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

type Body = {
  presetId?: unknown
}

/**
 * 後台：快選——把一個保存的遊戲勾選範本整份套用到指定 NPC，取代它原本的勾選
 * @returns 該 NPC 套用後完整的 allowedGames 清單（composite key）
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const userId = getRouterParam(event, 'userId') ?? ''
  const body = await readBody<Body>(event)
  const presetId = typeof body?.presetId === 'string' ? body.presetId : ''

  const allowedGames = await Storage.manager.admin.npcAutoPlay.applyGamePreset(userId, presetId)
  return { allowedGames }
})
