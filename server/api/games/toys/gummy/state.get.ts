import { sessionController } from '../../../../services/auth'
import { Storage } from '../../../../services/storage'
import { snapshotGummy } from '../../../../services/game/toys/gummy'

export default defineEventHandler((event) => {
  const login = sessionController.require(event)
  const user = Storage.get.user(login.id)
  return snapshotGummy(login.id, Number(user?.coin ?? 0))
})