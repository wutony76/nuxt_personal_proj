import { sessionController } from 'serv/services/auth'
import { adminAccessService } from 'serv/services/admin/modules/adminAccess'

/**
 * 回傳「是否為管理員／demo 唯讀角色」，不因為沒有權限就丟 403——由呼叫端（各後台頁面）
 * 自行決定要顯示無權限畫面還是導頁，不在這支端點就把使用者擋在外面。
 * 未登入則沿用既有 40001 慣例。
 */
export default defineEventHandler((event) => {
  const user = sessionController.require(event)
  const level = adminAccessService.accessLevel(user.id)
  return { isAdmin: level === 'admin', isDemo: level === 'demo', user }
})
