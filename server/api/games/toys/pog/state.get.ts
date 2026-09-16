import { sessionController } from '../../../../services/auth'
import { Storage } from '../../../../services/storage'
import { snapshotPog } from '../../../../services/game/toys/pog'

export default defineEventHandler((event) => {
  const login = sessionController.require(event)
  const user = Storage.get.user(login.id)
  return snapshotPog(login.id, Number(user?.coin ?? 0))
})