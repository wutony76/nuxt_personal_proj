import { sessionController } from '../../../../../services/auth'
import { Storage } from '../../../../../services/storage'

type RetroGameLike = {
  key: string
  name: string
  coinRate: number
  coinCapPerRun: number
  coinDailyCap: number
}

type Body = {
  coinRate?: unknown
  coinCapPerRun?: unknown
  coinDailyCap?: unknown
}

/**
 * 編輯單一遊戲的 coin 兌換三常數（見 design.md Decision 5）。
 * `RETRO_GAME_BASE` 的三個欄位本來就是一般可變欄位（非 readonly），這裡只是補上
 * 一支有管理員權限把關、有輸入驗證的寫入端點，不需要改動 base.ts 本身的資料結構。
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const key = getRouterParam(event, 'key')
  const instances = Storage.retroGames.instances as Record<string, RetroGameLike | undefined>
  const game = key ? instances[key] : undefined
  if (!game) {
    throw createError({ statusCode: 404, message: `找不到遊戲：${key}` })
  }

  const body = await readBody<Body>(event)
  const coinRate = Number(body?.coinRate)
  const coinCapPerRun = Number(body?.coinCapPerRun)
  const coinDailyCap = Number(body?.coinDailyCap)

  if (![coinRate, coinCapPerRun, coinDailyCap].every((n) => Number.isFinite(n))) {
    throw createError({ statusCode: 400, message: '三個欄位都必須是數字。' })
  }
  if ([coinRate, coinCapPerRun, coinDailyCap].some((n) => n <= 0)) {
    throw createError({ statusCode: 400, message: '數值必須為正數，coinCapPerRun 不得為 0。' })
  }
  if (coinCapPerRun > coinDailyCap) {
    throw createError({ statusCode: 400, message: '單局上限不得高於每日上限。' })
  }

  game.coinRate = coinRate
  game.coinCapPerRun = coinCapPerRun
  game.coinDailyCap = coinDailyCap

  return {
    key: game.key,
    name: game.name,
    coinRate: game.coinRate,
    coinCapPerRun: game.coinCapPerRun,
    coinDailyCap: game.coinDailyCap
  }
})
