import { Storage } from '../../../services/storage'
import { sessionController } from '../../../services/auth'
import { LOTTERY } from '~/config/constants'

export default defineEventHandler((event) => {
  const login = sessionController.require(event)
  const game = Storage.games[LOTTERY['LHC-OF'].key] as {
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
  return result ?? {
    ok: false,
    message: '領獎功能尚未初始化',
    issue: '',
    amount: 0,
    coin: 0
  }
})
