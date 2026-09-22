import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

type Body = {
  name?: unknown
  allowedGames?: unknown
}

/**
 * 後台：把一組遊戲勾選保存成命名範本，供之後任一 NPC 快選套用
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const body = await readBody<Body>(event)
  const name = typeof body?.name === 'string' ? body.name : ''
  const allowedGames = Array.isArray(body?.allowedGames) ? body.allowedGames.map(String) : []

  return Storage.manager.admin.npcAutoPlay.saveGamePreset(name, allowedGames)
})
