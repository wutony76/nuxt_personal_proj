import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/** 刪除聊天室排程 */
export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)
  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, message: '缺少排程 id。' })
  const ok = Storage.manager.admin.chatSchedule.remove(id)
  if (!ok) throw createError({ statusCode: 404, message: '找不到該排程。' })
  return { ok: true }
})
