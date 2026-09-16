import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/** 今彩539：當期資訊（內部佔位期別／狀態／倒數／單期額度上限／上一期官方開獎號） */
type D539Service = {
  get: {
    currentInfo: () => {
      issue: string
      currentStatus: string
      cutoffAt: number
      drawAt: number
      countdown: string
      quotaIssueMaxCoin: number
      quotaIssueMaxBets: number
      lastOpenCode: { issue: string; openCode: string[] } | null
      popularNumbers: Array<{ betCode: number[]; count: number }>
    }
    tiers: () => Array<{ key: string; label: string; desc: string | null }>
  }
}

export default defineEventHandler(() => {
  const game = Storage.games[LOTTERY.D539.key] as D539Service | undefined
  if (!game) throw createError({ statusCode: 503, message: '遊戲服務尚未初始化。' })

  return {
    ...game.get.currentInfo(),
    tiers: game.get.tiers()
  }
})
