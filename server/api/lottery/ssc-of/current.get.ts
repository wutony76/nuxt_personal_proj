import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/** 時時彩官方盤：當期資訊（期別／狀態／倒數／開獎號碼） */
type SscService = {
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
    poolState?: () => Record<string, unknown>
  }
}

export default defineEventHandler(() => {
  const game = Storage.games[LOTTERY['SSC-OF'].key] as SscService | undefined
  if (!game) throw createError({ statusCode: 503, message: '遊戲服務尚未初始化。' })

  const current = game.get.currentInfo()
  if (!current) throw createError({ statusCode: 503, message: '尚無開獎資料。' })

  // 彩池為 SSC-CD 與 SSC-OF 共用（見 server/services/game/lottery/bg/sscShared.ts），兩支路由回的是同一份
  const pool = game.get.poolState?.() ?? {}
  return { ...current, pool }
})
