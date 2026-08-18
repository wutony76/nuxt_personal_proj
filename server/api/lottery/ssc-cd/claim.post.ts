import { Storage } from '../../../services/storage'
import { sessionController } from '../../../services/auth'
import { LOTTERY } from '~/config/constants'

/** 時時彩信用盤：領取一期獎金 */
export default defineEventHandler((event) => {
  const login = sessionController.require(event)
  const game = Storage.games[LOTTERY['SSC-CD'].key] as {
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
