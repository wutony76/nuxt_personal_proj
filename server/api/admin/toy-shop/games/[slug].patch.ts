import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

type Body = {
  enabled?: unknown
}

/**
 * 後台：單一柑仔店玩法上架／下架（下架時前台不顯示，roll 路由回 403）
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const slug = getRouterParam(event, 'slug') ?? ''
  const body = await readBody<Body>(event)
  if (typeof body?.enabled !== 'boolean') {
    throw createError({ statusCode: 400, message: 'enabled 必須是 boolean。' })
  }

  return Storage.manager.lotteryTw.toyShop.setGameEnabled(slug, body.enabled)
})
