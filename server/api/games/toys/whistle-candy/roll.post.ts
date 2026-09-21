import { sessionController } from '../../../../services/auth'
import { Storage } from '../../../../services/storage'
import { walletBalanceService } from '../../../../services/walletBalance'
import { ToyPlayError } from '../../../../services/game/toys/luckyDraw'
import { playWhistle, type WhistleChoice } from '../../../../services/game/toys/whistleCandy'

type RollBody = { bet?: number; choice?: WhistleChoice }

export default defineEventHandler(async (event) => {
  const login = sessionController.require(event)
  if (!Storage.manager.lotteryTw.toyShop.isEnabled()) {
    throw createError({ statusCode: 403, message: '柑仔店櫥仔目前暫停開放。' })
  }
  if (!Storage.manager.lotteryTw.toyShop.isGameEnabled('whistle-candy')) {
    throw createError({ statusCode: 403, message: '此玩法目前暫停開放。' })
  }
  const body = await readBody<RollBody>(event)
  const user = Storage.get.user(login.id)
  try {
    return playWhistle({
      userId: login.id,
      bet: body?.bet,
      choice: body?.choice,
      balance: Number(user?.coin ?? 0),
      rng: Math.random,
      difficulty: Storage.manager.lotteryTw.toyShop.difficultyOf('whistle-candy'),
      wallet: {
        debit: (userId, amount, note) => walletBalanceService.appendChange(userId, { type: 'toy-bet', amount: -amount, note }),
        credit: (userId, amount, note) => walletBalanceService.appendChange(userId, {
          type: 'toy-reward',
          amount: Math.round(amount * Storage.manager.lotteryTw.toyShop.oddsOf('whistle-candy') * 100) / 100,
          note
        })
      }
    })
  } catch (error) {
    if (error instanceof ToyPlayError) throw createError({ statusCode: error.statusCode, message: error.message })
    throw error
  }
})
