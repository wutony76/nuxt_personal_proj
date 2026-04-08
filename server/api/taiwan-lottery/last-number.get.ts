type TaiwanLotteryGame = {
  code: number
  name: string
  en: string
}

type TaiwanLotteryRawItem = {
  gameCode: number
  gameName?: string
  period?: string
  lotNumber?: Array<string | number>
  [key: string]: unknown
}

type TaiwanLotteryApiResponse = {
  rtCode: number
  content?: {
    lastNumberList?: TaiwanLotteryRawItem[]
    bingo?: TaiwanLotteryRawItem
  }
}

const GAME: Record<number, TaiwanLotteryGame> = {
  5134: { code: 5134, name: '威力彩', en: 'WEILICAI' },
  5118: { code: 5118, name: '大樂透', en: 'DALETOU' },
  1197: { code: 1197, name: '今彩539', en: 'JINCAI539' },
  5120: { code: 5120, name: '39樂合彩', en: '39YUEHECAI' },
  1121: { code: 1121, name: '49樂合彩', en: '49YUEHECAI' },
  2108: { code: 2108, name: '3星彩', en: '3XINGCAI' },
  2109: { code: 2109, name: '4星彩', en: '4XINGCAI' },
  1102: { code: 1102, name: '賓果賓果', en: 'BINGUO' }
}

const GAME_ORDER = [5118, 5134, 1197, 1121, 5120, 2109, 2108, 1102]

export default defineEventHandler(async () => {
  const response = await $fetch<TaiwanLotteryApiResponse>(
    'https://api.taiwanlottery.com/TLCAPIWeB/Lottery/LastNumber'
  ).catch(() => null)

  if (!response || response.rtCode !== 0 || !response.content) {
    throw createError({
      statusCode: 502,
      statusMessage: '台彩開獎資料取得失敗'
    })
  }

  const out = new Map<number, Record<string, unknown>>()

  for (const item of response.content.lastNumberList ?? []) {
    const gameCode = Number(item.gameCode)
    const base = GAME[gameCode]
    out.set(gameCode, {
      ...item,
      gameCode,
      gameName: item.gameName || base?.name || `Game ${gameCode}`,
      en: base?.en || 'UNKNOWN',
      lotNumber: Array.isArray(item.lotNumber) ? item.lotNumber : []
    })
  }

  if (response.content.bingo?.gameCode) {
    const gameCode = Number(response.content.bingo.gameCode)
    const base = GAME[gameCode]
    out.set(gameCode, {
      ...response.content.bingo,
      gameCode,
      gameName: response.content.bingo.gameName || base?.name || `Game ${gameCode}`,
      en: base?.en || 'UNKNOWN',
      lotNumber: Array.isArray(response.content.bingo.lotNumber)
        ? response.content.bingo.lotNumber
        : []
    })
  }

  const results = [...out.values()].sort((a, b) => {
    const aIdx = GAME_ORDER.indexOf(Number(a.gameCode))
    const bIdx = GAME_ORDER.indexOf(Number(b.gameCode))
    const safeA = aIdx === -1 ? 999 : aIdx
    const safeB = bIdx === -1 ? 999 : bIdx
    return safeA - safeB
  })

  return {
    updatedAt: new Date().toISOString(),
    results
  }
})
