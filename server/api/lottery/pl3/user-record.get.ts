import { Storage } from '../../../services/storage'
import { sessionController } from '../../../services/auth'
import { LOTTERY } from '~/config/constants'

/** 排列3官方盤：該玩家的餘額變動／下注紀錄／可領獎金 */
export default defineEventHandler((event) => {
  const login = sessionController.require(event)
  const game = Storage.games[LOTTERY.PL3.key] as {
    get?: {
      userDialogRecord?: (userId: string) => {
        balanceChanges: Array<Record<string, unknown>>
        betHistory: Array<Record<string, unknown>>
        claimableIssues: Array<Record<string, unknown>>
      }
    }
  } | undefined

  const record = game?.get?.userDialogRecord?.(String(login.id))
  return {
    balanceChanges: record?.balanceChanges ?? [],
    betHistory: record?.betHistory ?? [],
    claimableIssues: record?.claimableIssues ?? []
  }
})
