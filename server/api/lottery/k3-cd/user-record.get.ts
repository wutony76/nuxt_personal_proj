import { Storage } from '../../../services/storage'
import { sessionController } from '../../../services/auth'
import { LOTTERY } from '~/config/constants'
import { walletBalanceService } from '../../../services/walletBalance'

/** 快3信用盤：該玩家的餘額變動／下注紀錄／可領獎金 */
export default defineEventHandler((event) => {
  const login = sessionController.require(event)
  const game = Storage.games[LOTTERY['K3-CD'].key] as {
    get?: {
      userDialogRecord?: (userId: string) => {
        balanceChanges: Array<Record<string, unknown>>
        betHistory: Array<Record<string, unknown>>
        claimableIssues: Array<Record<string, unknown>>
      }
      poolState?: () => Record<string, unknown>
    }
  } | undefined

  const record = game?.get?.userDialogRecord?.(String(login.id))
  return {
    balanceChanges: walletBalanceService.mergeForDialog(String(login.id), record?.balanceChanges ?? []),
    betHistory: record?.betHistory ?? [],
    claimableIssues: record?.claimableIssues ?? [],
    pool: game?.get?.poolState?.() ?? {}
  }
})
