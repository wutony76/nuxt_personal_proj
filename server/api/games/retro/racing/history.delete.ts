import { Storage } from '../../../../services/storage'
import { sessionController } from '../../../../services/auth'

const GAME_KEY = 'racing'

export default defineEventHandler((event) => {
  const login = sessionController.require(event)
  const game = Storage.retroGames.instances[GAME_KEY] as {
    actions?: { clear?: (userId: string) => void }
  } | undefined

  game?.actions?.clear?.(String(login.id))
  return { ok: true }
})
