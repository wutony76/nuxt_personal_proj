import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/**
 * 後台：刪除一個保存的遊戲勾選範本
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const id = getRouterParam(event, 'id') ?? ''
  await Storage.manager.admin.npcAutoPlay.deleteGamePreset(id)
  return { ok: true }
})
