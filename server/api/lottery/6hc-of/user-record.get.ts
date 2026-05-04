import { Storage } from '../../../services/storage'
import { sessionController } from '../../../services/auth'
import { LOTTERY } from '~/config/constants'

export default defineEventHandler((event) => {
  const login = sessionController.require(event)
  const game = Storage.games[LOTTERY['LHC-OF'].key] as {
    get?: {
      userDialogRecord?: (userId: string) => {
        balanceChanges: Array<Record<string, unknown>>
        betHistory: Array<Record<string, unknown>>
        claimableIssues: Array<Record<string, unknown>>
      }
      jackpotState?: () => {
        issue: string
        currentIssueJackpot: number
        carryJackpot: number
      }
    }
  } | undefined

  const record = game?.get?.userDialogRecord?.(String(login.id))
  const jackpot = game?.get?.jackpotState?.()
  return {
    balanceChanges: record?.balanceChanges ?? [],
    betHistory: record?.betHistory ?? [],
    claimableIssues: record?.claimableIssues ?? [],
    jackpot: jackpot ?? { issue: '', currentIssueJackpot: 0, carryJackpot: 0 }
  }
})
