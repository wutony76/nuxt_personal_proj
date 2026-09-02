import { Storage } from '../../../services/storage'
import { sessionController } from '../../../services/auth'
import { LOTTERY } from '~/config/constants'
import { walletBalanceService, type WalletBalanceChange } from '../../../services/walletBalance'

/** 快3官方盤：該玩家的餘額變動／下注紀錄／可領獎金 */
export default defineEventHandler((event) => {
  const login = sessionController.require(event)
  const game = Storage.games[LOTTERY['K3-OF'].key] as {
    get?: {
      userDialogRecord?: (userId: string) => {
        balanceChanges: WalletBalanceChange[]
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
