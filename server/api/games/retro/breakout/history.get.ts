import { Storage } from '../../../../services/storage'
import { sessionController } from '../../../../services/auth'
import type { RetroHistoryRecordRow } from '../../../../services/game/retro/history'

const GAME_KEY = 'breakout'

export default defineEventHandler((event) => {
  const login = sessionController.require(event)
  const game = Storage.retroGames.instances[GAME_KEY] as {
    get?: { history?: (userId: string) => RetroHistoryRecordRow[] }
  } | undefined

  const records = game?.get?.history?.(String(login.id)) ?? []
  return { records }
})
