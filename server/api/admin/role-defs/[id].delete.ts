import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/**
 * 刪除自訂角色（內建角色 admin／user／npc 不可刪除）。
 * 目前指派該角色的會員退回預設角色（'user'），並清掉該角色的遊戲權限開關紀錄。
 * @returns ok
 */
export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)
  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, message: '缺少角色 id。' })

  Storage.manager.admin.roleDefs.remove(id)
  Storage.manager.admin.access.clearRoleAssignments(id)
  Storage.manager.admin.roleGamePerms.clearRole(id)

  return { ok: true }
})
