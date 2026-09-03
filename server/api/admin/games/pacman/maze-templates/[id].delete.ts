import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const removed = id ? Storage.manager.gameRetro.mazeTemplates.remove(id) : false
  if (!removed) {
    throw createError({ statusCode: 404, message: '找不到這筆樣板。' })
  }
  return { ok: true }
})
