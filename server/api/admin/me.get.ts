import { sessionController } from '../../services/auth'

/**
 * 回傳「是否為管理員」，不因為不是管理員就丟 403——由呼叫端（各後台頁面）自行決定要顯示
 * 無權限畫面還是導頁，不在這支端點就把使用者擋在外面。未登入則沿用既有 40001 慣例。
 */
export default defineEventHandler((event) => {
  const user = sessionController.require(event)
  return { isAdmin: sessionController.isAdmin(user), user }
})
