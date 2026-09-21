import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

type Body = {
  multiplier?: unknown
}

/**
 * 後台：設定單一柑仔店玩法的賠率倍數（套用在實際派彩金額上）
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const slug = getRouterParam(event, 'slug') ?? ''
  const body = await readBody<Body>(event)

  return Storage.manager.lotteryTw.toyShop.setOdds(slug, Number(body?.multiplier))
})
