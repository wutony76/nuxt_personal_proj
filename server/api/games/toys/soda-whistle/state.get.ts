import { sessionController } from '../../../../services/auth'
import { Storage } from '../../../../services/storage'
import { snapshotSoda } from '../../../../services/game/toys/sodaWhistle'

export default defineEventHandler((event) => {
  const login = sessionController.require(event)
  const user = Storage.get.user(login.id)
  return snapshotSoda(login.id, Number(user?.coin ?? 0))
})
