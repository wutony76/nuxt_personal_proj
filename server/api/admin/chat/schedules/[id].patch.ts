import { sessionController } from '../../../../services/auth'
import { chatScheduleService } from '../../../../services/social/chatSchedule'

type Body = {
  enabled?: unknown
}

/**
 * 更新聊天室排程開關
 * @returns 更新後的排程
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)
  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, message: '缺少排程 id。' })

  const body = await readBody<Body>(event)
  if (typeof body?.enabled !== 'boolean') {
    throw createError({ statusCode: 400, message: 'enabled 須為 boolean。' })
  }

  const schedule = chatScheduleService.setEnabled(id, body.enabled)
  if (!schedule) throw createError({ statusCode: 404, message: '找不到該排程。' })
  return { schedule }
})
