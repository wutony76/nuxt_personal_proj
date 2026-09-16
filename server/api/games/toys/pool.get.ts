import { sessionController } from '../../../services/auth'
import { Storage } from '../../../services/storage'
import { snapshotLuckyDraw } from '../../../services/game/toys/luckyDraw'

export default defineEventHandler((event) => {
  const login = sessionController.require(event)
  const user = Storage.get.user(login.id)
  return snapshotLuckyDraw(login.id, Number(user?.coin ?? 0))
})
