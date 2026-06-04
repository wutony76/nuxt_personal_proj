import { Storage } from '../../../services/storage'
import { LOTTERY } from '~/config/constants'

type Lottery6hcCdService = {
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
    jackpotState?: () => {
      issue: string
      currentIssueJackpot: number
      carryJackpot: number
      jackpotBase: number
    }
  }
}

export default defineEventHandler(() => {
  const game = Storage.games[LOTTERY['LHC-CD'].key] as Lottery6hcCdService | undefined
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

  const jackpot = game.get.jackpotState?.() ?? { issue: '', currentIssueJackpot: 0, carryJackpot: 0 }

  return { ...current, jackpot }
})
