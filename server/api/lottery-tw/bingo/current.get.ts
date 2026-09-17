import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/** 賓果賓果：當期資訊（內部佔位期別／狀態／倒數／上一期官方開獎號＋大小/單雙/超級獎號） */
type BingoService = {
  get: {
    currentInfo: () => {
      issue: string
      currentStatus: string
      cutoffAt: number
      drawAt: number
      countdown: string
      lastOpenCode: { issue: string; openCode: string[]; superNumber: string; lotBigSmall: string; lotOddEven: string } | null
    }
    betTypes: () => Array<{ key: string; label: string; desc: string }>
  }
}

export default defineEventHandler(() => {
  const game = Storage.games[LOTTERY.BINGO.key] as BingoService | undefined
  if (!game) throw createError({ statusCode: 503, message: '遊戲服務尚未初始化。' })

  return {
    ...game.get.currentInfo(),
    betTypes: game.get.betTypes()
  }
})
