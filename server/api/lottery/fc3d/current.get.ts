import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/** 福彩3D官方盤：當期資訊（期別／狀態／倒數／開獎三球） */
type Fc3dService = {
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
  const game = Storage.games[LOTTERY.FC3D.key] as Fc3dService | undefined
  if (!game) throw createError({ statusCode: 503, message: '遊戲服務尚未初始化。' })

  const current = game.get.currentInfo()
  if (!current) throw createError({ statusCode: 503, message: '尚無開獎資料。' })

  return current
})
