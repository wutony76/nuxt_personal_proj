import { Storage } from '../../../services/storage'
import { sessionController } from '../../../services/auth'
import { LOTTERY } from '~/config/constants'

/** 賓果賓果：領取一期獎金（含猜大小/猜單雙和局退款，退款走同一個 claimableIssues 機制） */
export default defineEventHandler((event) => {
  const login = sessionController.require(event)
  const game = Storage.games[LOTTERY.BINGO.key] as {
    actions?: {
      claimOneIssue?: (userId: string) => {
        ok: boolean
        message: string
        issue: string
        amount: number
        coin: number
      }
    }
  } | undefined

  const result = game?.actions?.claimOneIssue?.(String(login.id))
  return result ?? { ok: false, message: '領獎功能尚未初始化', issue: '', amount: 0, coin: 0 }
})
