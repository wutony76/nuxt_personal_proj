import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

type Body = {
  words?: unknown
}

/**
 * 後台：設定「自動新增 NPC 會員」用的單字庫（整份取代）
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const body = await readBody<Body>(event)
  const words = Array.isArray(body?.words) ? body.words.map(String) : []

  const nameWords = await Storage.manager.admin.npcAutoPlay.setNameWords(words)
  return { nameWords }
})
