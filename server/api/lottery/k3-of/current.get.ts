import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/** 快3官方盤：當期資訊（期別／狀態／倒數／開獎骰子） */
type K3Service = {
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
  const game = Storage.games[LOTTERY['K3-OF'].key] as K3Service | undefined
  if (!game) throw createError({ statusCode: 503, message: '遊戲服務尚未初始化。' })

  const current = game.get.currentInfo()
  if (!current) throw createError({ statusCode: 503, message: '尚無開獎資料。' })

  // 彩池為 K3-CD 與 K3-OF 共用（見 server/services/game/lottery/bg/k3Shared.ts），兩支路由回的是同一份
  const pool = game.get.poolState?.() ?? {}
  return { ...current, pool }
})
