import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

type Body = {
  coinRate?: unknown
  coinCapPerRun?: unknown
  coinDailyCap?: unknown
}

/**
 * 編輯單一遊戲的 coin 兌換三常數（見 design.md Decision 5）。
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const key = getRouterParam(event, 'key') ?? ''
  const body = await readBody<Body>(event)

  return Storage.manager.gameRetro.retroGameRates.setRates(key, {
    coinRate: Number(body?.coinRate),
    coinCapPerRun: Number(body?.coinCapPerRun),
    coinDailyCap: Number(body?.coinDailyCap)
  })
})
