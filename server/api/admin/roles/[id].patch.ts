import { sessionController } from '../../../services/auth'
import { adminAccessService, type UserRole } from '../../../services/admin/adminAccess'

type Body = {
  role?: unknown
}

/**
 * 設定帳號角色為 admin 或 user
 * @returns 更新後的帳號
 */
export default defineEventHandler(async (event) => {
  const actor = sessionController.requireAdmin(event)
  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, message: '缺少帳號 id。' })

  const body = await readBody<Body>(event)
  const roleRaw = String(body?.role ?? '')
  if (roleRaw !== 'admin' && roleRaw !== 'user') {
    throw createError({ statusCode: 400, message: 'role 須為 admin 或 user。' })
  }
  const role = roleRaw as UserRole

  const user = adminAccessService.setRole(id, role, actor.id)
  return { user }
})
