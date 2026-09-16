import { sessionController } from '../../../../services/auth'
import { Storage } from '../../../../services/storage'
import { snapshotBigPig } from '../../../../services/game/toys/bigPig'

export default defineEventHandler((event) => {
  const login = sessionController.require(event)
  const user = Storage.get.user(login.id)
  return snapshotBigPig(login.id, Number(user?.coin ?? 0))
})