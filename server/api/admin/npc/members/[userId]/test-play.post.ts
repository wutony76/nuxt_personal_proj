import { sessionController } from 'serv/services/auth'
import { adminAccessService } from 'serv/services/admin/modules/adminAccess'
import { testPlayAll } from 'serv/services/admin/modules/npcAutoPlay'

/**
 * 後台：對指定 NPC 的全部勾選遊戲各測試執行一局，回傳每款結果。
 * 不受總開關、時段、每日上限、行動節流限制，僅供測試驗證用途。
 * @returns { results: TestPlayResultItem[] }
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const userId = getRouterParam(event, 'userId') ?? ''
  if (adminAccessService.roleOf(userId) !== 'npc') {
    throw createError({ statusCode: 400, message: '此會員不是 NPC 角色。' })
  }

  const results = await testPlayAll(userId)
  return { results }
})
