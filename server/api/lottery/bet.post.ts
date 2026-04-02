import { getMockLotteryStore, type BetRecord } from '../../utils/mockLotteryStore'

type BetPayload = {
  gameId?: number
  betType?: string
  number?: string
  amount?: number
}

export default defineEventHandler(async (event) => {
  const payload = await readBody<BetPayload>(event)
  const store = getMockLotteryStore()

  const game = store.games.find((item) => item.id === payload.gameId)
  if (!game) {
    throw createError({ statusCode: 400, statusMessage: '找不到遊戲。' })
  }

  const amount = Number(payload.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw createError({ statusCode: 400, statusMessage: '下注金額格式錯誤。' })
  }

  if (amount < game.minBet || amount > game.maxBet) {
    throw createError({
      statusCode: 400,
      statusMessage: `金額需介於 ${game.minBet} ~ ${game.maxBet}。`
    })
  }

  if (amount > store.balance) {
    throw createError({ statusCode: 400, statusMessage: '餘額不足。' })
  }

  const betType = payload.betType?.trim() || game.playTypes[0]
  if (!game.playTypes.includes(betType)) {
    throw createError({ statusCode: 400, statusMessage: '不支援的玩法。' })
  }
  const number = payload.number?.trim()
  if (!number) {
    throw createError({ statusCode: 400, statusMessage: '請輸入下注號碼。' })
  }

  const record: BetRecord = {
    id: `BET-${Date.now()}`,
    gameId: game.id,
    gameName: game.name,
    betType,
    number,
    amount,
    odds: game.defaultOdds,
    potentialPayout: Number((amount * game.defaultOdds).toFixed(2)),
    createdAt: new Date().toISOString(),
    status: 'accepted'
  }

  store.balance = Number((store.balance - amount).toFixed(2))
  store.bets.unshift(record)

  return {
    message: '下注成功',
    balance: store.balance,
    bet: record
  }
})
