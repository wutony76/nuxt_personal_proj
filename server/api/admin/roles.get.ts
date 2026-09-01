import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { ADMIN_USER_IDS } from '../../config/admin'

/** 顯示目前管理員白名單（唯讀）；異動需改 server/config/admin.ts 並重新部署，見 design.md Decision 1 */
export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)
  const accounts = Storage.get.account()
  const admins = ADMIN_USER_IDS.map((id) => {
    const account = accounts[id]
    return {
      id,
      name: account?.name ?? '（帳號不存在）',
      email: account?.email ?? ''
    }
  })
  return { admins }
})
