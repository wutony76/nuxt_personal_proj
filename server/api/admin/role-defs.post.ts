import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

type Body = {
  name?: unknown
}

/**
 * 新增自訂角色
 * @returns 新建角色
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)
  const body = await readBody<Body>(event)
  const role = Storage.manager.admin.roleDefs.create({
    name: typeof body?.name === 'string' ? body.name : ''
  })
  return { role }
})
