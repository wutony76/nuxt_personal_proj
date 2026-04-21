import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

type Lottery6hcOfService = {
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
  const game = Storage.games[LOTTERY['LHC-OF'].key] as Lottery6hcOfService | undefined
  if (!game) {
    throw createError({
      statusCode: 503,
      statusMessage: '遊戲服務尚未初始化。'
    })
  }

  const current = game.get.currentInfo()
  if (!current) {
    throw createError({
      statusCode: 503,
      statusMessage: '尚無開獎資料。'
    })
  }

  return current
})
