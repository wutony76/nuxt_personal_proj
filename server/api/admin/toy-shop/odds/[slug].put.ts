import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

type Body = {
  multiplier?: unknown
  difficulty?: unknown
}

/**
 * 後台：設定單一柑仔店玩法的賠率倍數（套用在實際派彩金額上）與難度
 * （額外未中獎機率，套用在玩家實際能否拿到中獎金額上）
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const slug = getRouterParam(event, 'slug') ?? ''
  const body = await readBody<Body>(event)

  return Storage.manager.lotteryTw.toyShop.setOdds(slug, {
    multiplier: Number(body?.multiplier),
    difficulty: Number(body?.difficulty)
  })
})
