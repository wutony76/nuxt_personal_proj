import { Storage } from '../../../../services/storage'
import { sessionController } from '../../../../services/auth'
import type { RecordInput, RecordResult } from '../../../../services/game/retro/base'

const GAME_KEY = 'arkanoid'

export default defineEventHandler(async (event) => {
  const login = sessionController.require(event)
  const body = await readBody<RecordInput>(event)
  const game = Storage.retroGames.instances[GAME_KEY] as {
    actions?: { record?: (userId: string, input: RecordInput) => RecordResult }
  } | undefined

  const result = game?.actions?.record?.(String(login.id), {
    score: Number(body?.score ?? 0),
    ...(body?.level !== undefined ? { level: Number(body.level) } : {}),
    ...(body?.meta ? { meta: body.meta } : {})
  })

  return result ?? { record: null, coinReward: 0, coinCapped: false, newCoinBalance: 0 }
})
