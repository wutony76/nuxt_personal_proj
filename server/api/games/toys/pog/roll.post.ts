import { sessionController } from '../../../../services/auth'
import { Storage } from '../../../../services/storage'
import { walletBalanceService } from '../../../../services/walletBalance'
import { ToyPlayError } from '../../../../services/game/toys/luckyDraw'
import { playPog } from '../../../../services/game/toys/pog'

type RollBody = { action?: 'start' | 'play'; bet?: number; cardId?: string }

export default defineEventHandler(async (event) => {
  const login = sessionController.require(event)
  if (!Storage.manager.lotteryTw.toyShop.isEnabled()) {
    throw createError({ statusCode: 403, message: '柑仔店櫥仔目前暫停開放。' })
  }
  if (!Storage.manager.lotteryTw.toyShop.isGameEnabled('pog')) {
    throw createError({ statusCode: 403, message: '此玩法目前暫停開放。' })
  }
  const body = await readBody<RollBody>(event)
  const user = Storage.get.user(login.id)
  const action = body?.action
  if (action !== 'start' && action !== 'play') {
    throw createError({ statusCode: 400, message: '動作不正確。' })
  }
  try {
    return playPog({
      userId: login.id,
      action,
      bet: body?.bet,
      cardId: body?.cardId,
      balance: Number(user?.coin ?? 0),
      rng: Math.random,
      difficulty: Storage.manager.lotteryTw.toyShop.difficultyOf('pog'),
      wallet: {
        debit: (userId, amount, note) => walletBalanceService.appendChange(userId, { type: 'toy-bet', amount: -amount, note }),
        credit: (userId, amount, note) => walletBalanceService.appendChange(userId, {
          type: 'toy-reward',
          amount: Math.round(amount * Storage.manager.lotteryTw.toyShop.oddsOf('pog') * 100) / 100,
          note
        })
      }
    })
  } catch (error) {
    if (error instanceof ToyPlayError) throw createError({ statusCode: error.statusCode, message: error.message })
    throw error
  }
})
