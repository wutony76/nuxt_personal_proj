import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

type Body = {
  role?: unknown
}

/**
 * 設定帳號角色（角色 id 須存在於角色清單，見 role-defs）
 * @returns 更新後的帳號
 */
export default defineEventHandler(async (event) => {
  const actor = sessionController.requireAdmin(event)
  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, message: '缺少帳號 id。' })

  const body = await readBody<Body>(event)
  const role = String(body?.role ?? '').trim()
  if (!role || !Storage.manager.admin.roleDefs.exists(role)) {
    throw createError({ statusCode: 400, message: '角色不存在。' })
  }

  const user = Storage.manager.admin.access.setRole(id, role, actor.id)
  return { user }
})
