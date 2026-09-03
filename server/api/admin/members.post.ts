import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'
import type { UserRole } from 'serv/services/admin/modules/adminAccess'

type Body = {
  name?: unknown
  email?: unknown
  password?: unknown
  role?: unknown
}

/**
 * 後台新增會員
 * @returns 新建帳號（不含密碼）
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)
  const body = await readBody<Body>(event)
  const roleRaw = String(body?.role ?? 'user')
  const role: UserRole = roleRaw === 'admin' ? 'admin' : 'user'

  const user = Storage.manager.admin.access.createMember({
    name: typeof body?.name === 'string' ? body.name : '',
    email: typeof body?.email === 'string' ? body.email : '',
    password: typeof body?.password === 'string' ? body.password : '',
    role
  })
  return { user }
})
