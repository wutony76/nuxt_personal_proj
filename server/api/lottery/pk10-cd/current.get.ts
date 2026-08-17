import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/** PK10信用盤：當期資訊（期別／狀態／倒數／開獎名次） */
type Pk10Service = {
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
  const game = Storage.games[LOTTERY['PK10-CD'].key] as Pk10Service | undefined
  if (!game) throw createError({ statusCode: 503, statusMessage: '遊戲服務尚未初始化。' })

  const current = game.get.currentInfo()
  if (!current) throw createError({ statusCode: 503, statusMessage: '尚無開獎資料。' })

  // 彩池為 PK10-CD 與 PK10-OF 共用（見 server/services/game/lottery/bg/pk10Shared.ts），兩支路由回的是同一份
  const pool = game.get.poolState?.() ?? {}
  return { ...current, pool }
})
