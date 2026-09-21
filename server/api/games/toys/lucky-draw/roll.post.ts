import { sessionController } from '../../../../services/auth'
import { Storage } from '../../../../services/storage'
import { walletBalanceService } from '../../../../services/walletBalance'
import { ToyPlayError, playLuckyDraw, type LuckyDrawAction } from '../../../../services/game/toys/luckyDraw'

type RollBody = {
  action?: LuckyDrawAction
  bet?: number
  cellIndex?: number
}

export default defineEventHandler(async (event) => {
  const login = sessionController.require(event)
  if (!Storage.manager.lotteryTw.toyShop.isEnabled()) {
    throw createError({ statusCode: 403, message: '柑仔店櫥仔目前暫停開放。' })
  }
  const body = await readBody<RollBody>(event)
  const user = Storage.get.user(login.id)
  const action = body?.action
  if (action !== 'start' && action !== 'continue' && action !== 'claim') {
    throw createError({ statusCode: 400, message: '動作不正確。' })
  }

  try {
    return playLuckyDraw({
      userId: login.id,
      action,
      bet: body?.bet,
      cellIndex: body?.cellIndex,
      balance: Number(user?.coin ?? 0),
      rng: Math.random,
      wallet: {
        debit: (userId, amount, note) => walletBalanceService.appendChange(userId, {
          type: 'toy-bet',
          amount: -amount,
          note
        }),
        credit: (userId, amount, note) => walletBalanceService.appendChange(userId, {
          type: 'toy-reward',
          amount: Math.round(amount * Storage.manager.lotteryTw.toyShop.oddsOf('lucky-draw') * 100) / 100,
          note
        })
      }
    })
  } catch (error) {
    if (error instanceof ToyPlayError) {
      throw createError({ statusCode: error.statusCode, message: error.message })
    }
    throw error
  }
})
