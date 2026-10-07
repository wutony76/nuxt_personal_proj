import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/**
 * 刪除會員（見 openspec/changes/add-delete-member/design.md 第 3 節）。路由當編排層，依序清理
 * NPC/登入紀錄的記憶體狀態（純記憶體操作，沒有副作用，DB delete 失敗也沒關係），最後才執行
 * 會員本體的 write-through delete——失敗時整個刪除動作視為沒發生。
 */
export default defineEventHandler(async (event) => {
  const actor = sessionController.requireAdmin(event)
  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, message: '缺少會員 id。' })

  Storage.manager.admin.npcAutoPlay.removeMemberData(id)
  Storage.manager.admin.loginHistory.remove(id)
  await Storage.manager.admin.access.deleteMember(id, actor.id)

  return { ok: true }
})
