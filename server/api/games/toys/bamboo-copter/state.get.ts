import { sessionController } from '../../../../services/auth'
import { Storage } from '../../../../services/storage'
import { snapshotBamboo } from '../../../../services/game/toys/bambooCopter'

export default defineEventHandler((event) => {
  const login = sessionController.require(event)
  const user = Storage.get.user(login.id)
  return snapshotBamboo(login.id, Number(user?.coin ?? 0))
})