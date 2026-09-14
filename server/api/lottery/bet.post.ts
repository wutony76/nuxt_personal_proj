import { Storage } from '../../services/storage'
import { sessionController } from '../../services/auth'
import { throwErrCode } from '../../utils/error'
import { TW_GAMES } from '#shared/config/gameSlugs'

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

  if (!_login || !_user) throwErrCode(40001)
  const amount = Number(payload.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw createError({ statusCode: 400, message: '下注金額格式錯誤' })
  }
  if (amount > _user.coin) throwErrCode(50001)

  const getLottery = payload.lottery
  if (!getLottery?.key) throw createError({ statusCode: 400, message: '彩種參數錯誤' })
  const gameClass = (Storage.games as Record<string, { playBets: (payload: BetPayload, user: LoginUser) => BetResult }>)[getLottery.key]
  if (!gameClass?.playBets) throw createError({ statusCode: 400, message: '彩種不存在' })

  const roleId = Storage.manager.admin.access.roleOf(_login.id)
  // ⚠️ category 一律由伺端依 getLottery.key 反查 TW_GAMES 決定，不可信任前端送來的分類欄位
  // （payload.lottery 目前型別是 any，偽造分類可繞過另一分類的角色限制，見 add-dlt/design.md Decision 0）
  const category = TW_GAMES.some((g) => g.key === getLottery.key) ? 'tw' : 'bg'
  if (!Storage.manager.admin.roleGamePerms.isEnabled(roleId, category, getLottery.key)) {
    throw createError({ statusCode: 403, message: '目前角色未開放此盤口。' })
  }
  const betResult = gameClass.playBets(payload, _user)
  return {
    message: '下注成功',
    coin: _user.coin,
    orderId: betResult?.orderId ?? '',
    orders: Array.isArray(betResult?.orders) ? betResult.orders : []
  }
})
