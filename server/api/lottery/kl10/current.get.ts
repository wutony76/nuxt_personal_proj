import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/** 快樂十分：當期資訊（期別／狀態／倒數／開獎球） */
type Kl10Service = {
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
  const game = Storage.games[LOTTERY.KL10.key] as Kl10Service | undefined
  if (!game) throw createError({ statusCode: 503, message: '遊戲服務尚未初始化。' })

  const current = game.get.currentInfo()
  if (!current) throw createError({ statusCode: 503, message: '尚無開獎資料。' })

  return current
})
