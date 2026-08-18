import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/** PC蛋蛋信用盤：當期資訊（期別／狀態／倒數／開獎球） */
type EggsService = {
  get: {
    currentInfo: () => {
      issueCurrent: string
      issueLatest: string
      currentStatus: string
      countdown: string
      statusEndAt: number
      openCode: string[]
      openCodePlay: Array<Record<string, unknown>>
    } | null
  }
}

export default defineEventHandler(() => {
  const game = Storage.games[LOTTERY.EGGS.key] as EggsService | undefined
  if (!game) throw createError({ statusCode: 503, message: '遊戲服務尚未初始化。' })

  const current = game.get.currentInfo()
  if (!current) throw createError({ statusCode: 503, message: '尚無開獎資料。' })

  return current
})
