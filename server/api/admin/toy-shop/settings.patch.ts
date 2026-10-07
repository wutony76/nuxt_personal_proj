import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

type Body = {
  enabled?: unknown
}

/**
 * 後台：切換柑仔店櫥仔整體開關
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const body = await readBody<Body>(event)
  if (typeof body?.enabled !== 'boolean') {
    throw createError({ statusCode: 400, message: 'enabled 必須是 boolean。' })
  }

  return {
    enabled: await Storage.manager.lotteryTw.toyShop.setEnabled(body.enabled)
  }
})
