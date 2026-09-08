import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/**
 * 查詢指定角色兩分類全部項目的開關狀態
 * @returns games
 */
export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)
  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, message: '缺少角色 id。' })

  return { games: Storage.manager.admin.roleGamePerms.listForRole(id) }
})
