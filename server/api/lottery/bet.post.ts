import { Storage } from '../../services/storage'
import { sessionController } from '../../services/auth'
import { STATUS_ERR_CODE } from '~/config/constants.js'

type BetPayload = {
  lottery?: any
  groups?: any[]
  amount?: number
}

type LoginUser = {
  userId: string
  coin: number
}

type BetResult = {
  orderId: string
  orders: Array<Record<string, unknown>>
}

export default defineEventHandler(async (event) => {
  const payload = await readBody<BetPayload>(event)
  const _login = sessionController.require(event)
  const _user = Storage.get.user(_login.id) as LoginUser | undefined
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
  if (!getLottery?.key) throw createError({ statusCode: 400, statusMessage: '彩種參數錯誤' })
  const gameClass = (Storage.games as Record<string, { playBets: (payload: BetPayload, user: LoginUser) => BetResult }>)[getLottery.key]
  if (!gameClass?.playBets) throw createError({ statusCode: 400, statusMessage: '彩種不存在' })
  const betResult = gameClass.playBets(payload, _user)
  return {
    message: '下注成功',
    coin: _user.coin,
    orderId: betResult?.orderId ?? '',
    orders: Array.isArray(betResult?.orders) ? betResult.orders : []
  }
})
