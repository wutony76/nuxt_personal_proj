import { Storage } from '../../services/storage'
import { sessionController } from '../../services/auth'
import { STATUS_ERR_CODE } from '~/config/constants.js'
import { PLAYLIST } from '~/config/bg/6hc-of'

type BetPayload = {
  lottery?: any
  groups?: any[]
  amount?: number
}

export default defineEventHandler(async (event) => {
  const payload = await readBody<BetPayload>(event)
  const _login = sessionController.require(event)
  const _user = Storage.get.user(_login.id)
  console.log('TTT2.API bet.post.payload', payload)
  console.log('TTT2.API bet.post.user', _user, payload.lottery)

  if (!_login || !_user) {
    throw createError({
      statusCode: STATUS_ERR_CODE[40001].code,
      statusMessage: STATUS_ERR_CODE[40001].message,
    })
  }
  const amount = Number(payload.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw createError({ statusCode: -1, statusMessage: '下注金額格式錯誤' })
  if (amount > _user.coin) throw createError({ statusCode: 400, statusMessage: '餘額不足' })

  const getLottery = payload.lottery
  const gameClass = Storage.games[getLottery.key]
  gameClass.playBets(payload, _user)
  return {
    message: '下注成功',
    coin: _user.coin,
  }
})
