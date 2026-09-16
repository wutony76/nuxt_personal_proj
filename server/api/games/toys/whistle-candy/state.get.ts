import { sessionController } from '../../../../services/auth'
import { Storage } from '../../../../services/storage'
import { snapshotWhistle } from '../../../../services/game/toys/whistleCandy'

export default defineEventHandler((event) => {
  const login = sessionController.require(event)
  const user = Storage.get.user(login.id)
  return snapshotWhistle(login.id, Number(user?.coin ?? 0))
})