import { sessionController } from '../../../../services/auth'
import { Storage } from '../../../../services/storage'
import { walletBalanceService } from '../../../../services/walletBalance'
import { ToyPlayError } from '../../../../services/game/toys/luckyDraw'
import { playPog } from '../../../../services/game/toys/pog'

type RollBody = { action?: 'start' | 'play'; bet?: number; cardId?: string }

export default defineEventHandler(async (event) => {
  const login = sessionController.require(event)
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
      wallet: {
        debit: (userId, amount, note) => walletBalanceService.appendChange(userId, { type: 'toy-bet', amount: -amount, note }),
        credit: (userId, amount, note) => walletBalanceService.appendChange(userId, { type: 'toy-reward', amount, note })
      }
    })
  } catch (error) {
    if (error instanceof ToyPlayError) throw createError({ statusCode: error.statusCode, message: error.message })
    throw error
  }
})
