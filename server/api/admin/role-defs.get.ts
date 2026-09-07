import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/**
 * 列出全部角色（含內建與自訂）
 * @returns roles
 */
export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)
  return { roles: Storage.manager.admin.roleDefs.list() }
})
