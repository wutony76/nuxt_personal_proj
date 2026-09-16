import { sessionController } from '../../../../services/auth'
import { Storage } from '../../../../services/storage'
import { snapshotCards } from '../../../../services/game/toys/cards'

export default defineEventHandler((event) => {
  const login = sessionController.require(event)
  const user = Storage.get.user(login.id)
  return snapshotCards(login.id, Number(user?.coin ?? 0))
})
