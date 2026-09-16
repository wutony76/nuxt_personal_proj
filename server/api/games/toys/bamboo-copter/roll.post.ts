import { sessionController } from '../../../../services/auth'
import { Storage } from '../../../../services/storage'
import { walletBalanceService } from '../../../../services/walletBalance'
import { playBamboo, type BambooTargetId } from '../../../../services/game/toys/bambooCopter'
import { ToyPlayError } from '../../../../services/game/toys/luckyDraw'

type RollBody = {
  bet?: number
  target?: BambooTargetId
}

export default defineEventHandler(async (event) => {
  const login = sessionController.require(event)
  const body = await readBody<RollBody>(event)
  const user = Storage.get.user(login.id)
  try {
    return playBamboo({
      userId: login.id,
      bet: body?.bet,
      target: body?.target,
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
