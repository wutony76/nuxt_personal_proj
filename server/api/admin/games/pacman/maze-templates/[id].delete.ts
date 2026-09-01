import { sessionController } from '../../../../../services/auth'
import { mazeTemplates } from '../../../../../services/game/retro/mazeTemplates'

export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const removed = id ? mazeTemplates.remove(id) : false
  if (!removed) {
    throw createError({ statusCode: 404, message: '找不到這筆樣板。' })
  }
  return { ok: true }
})
