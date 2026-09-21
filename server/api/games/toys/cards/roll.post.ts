import { sessionController } from '../../../../services/auth'
import { Storage } from '../../../../services/storage'
import { walletBalanceService } from '../../../../services/walletBalance'
import { playCards, type CardChoice } from '../../../../services/game/toys/cards'
import { ToyPlayError } from '../../../../services/game/toys/luckyDraw'

type RollBody = {
  action?: 'start' | 'guess' | 'claim'
  bet?: number
  choice?: CardChoice
}

export default defineEventHandler(async (event) => {
  const login = sessionController.require(event)
  if (!Storage.manager.lotteryTw.toyShop.isEnabled()) {
    throw createError({ statusCode: 403, message: '柑仔店櫥仔目前暫停開放。' })
  }
  const body = await readBody<RollBody>(event)
  const user = Storage.get.user(login.id)
  const action = body?.action
  if (action !== 'start' && action !== 'guess' && action !== 'claim') {
    throw createError({ statusCode: 400, message: '動作不正確。' })
  }
  try {
    return playCards({
      userId: login.id,
      action,
      bet: body?.bet,
      choice: body?.choice,
      balance: Number(user?.coin ?? 0),
      rng: Math.random,
      wallet: {
        debit: (userId, amount, note) => walletBalanceService.appendChange(userId, { type: 'toy-bet', amount: -amount, note }),
        credit: (userId, amount, note) => walletBalanceService.appendChange(userId, {
          type: 'toy-reward',
          amount: Math.round(amount * Storage.manager.lotteryTw.toyShop.oddsOf('cards') * 100) / 100,
          note
        })
      }
    })
  } catch (error) {
    if (error instanceof ToyPlayError) throw createError({ statusCode: error.statusCode, message: error.message })
    throw error
  }
})
