import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/**
 * 列出全部帳號與目前角色（admin／user）
 * @returns users
 */
export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)
  const users = Storage.manager.admin.access.listUsers()
  return {
    users,
    /** 相容舊前端：僅 admin 列表 */
    admins: users.filter((u) => u.role === 'admin').map(({ id, name, email }) => ({ id, name, email }))
  }
})
