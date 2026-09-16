import { sessionController } from '../../../../services/auth'
import { Storage } from '../../../../services/storage'
import { walletBalanceService } from '../../../../services/walletBalance'
import { playGummy, type GummyColor } from '../../../../services/game/toys/gummy'
import { ToyPlayError } from '../../../../services/game/toys/luckyDraw'

type RollBody = {
  action?: 'start' | 'guess' | 'claim'
  bet?: number
  guess?: GummyColor
}

export default defineEventHandler(async (event) => {
  const login = sessionController.require(event)
  const body = await readBody<RollBody>(event)
  const user = Storage.get.user(login.id)
  const action = body?.action
  if (action !== 'start' && action !== 'guess' && action !== 'claim') {
    throw createError({ statusCode: 400, message: '動作不正確。' })
  }
  try {
    return playGummy({
      userId: login.id,
      action,
      bet: body?.bet,
      guess: body?.guess,
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
