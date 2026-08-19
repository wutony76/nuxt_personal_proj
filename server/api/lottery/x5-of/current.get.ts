import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

/** 11選5 官方盤：當期資訊（期別／狀態／倒數／開獎號碼） */
type X5Service = {
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
  const game = Storage.games[LOTTERY['X5-OF'].key] as X5Service | undefined
  if (!game) throw createError({ statusCode: 503, message: '遊戲服務尚未初始化。' })

  const current = game.get.currentInfo()
  if (!current) throw createError({ statusCode: 503, message: '尚無開獎資料。' })

  // 彩池為 X5-CD 與 X5-OF 共用（見 server/services/game/lottery/bg/x5Shared.ts），兩支路由回的是同一份
  // ⚠️ 官方盤的後三直選會真的從這個池分層派彩（信用盤只抽水養池、不吃池）
  const pool = game.get.poolState?.() ?? {}
  return { ...current, pool }
})
