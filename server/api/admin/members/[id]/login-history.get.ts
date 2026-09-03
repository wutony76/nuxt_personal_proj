import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/**
 * 取得會員登入紀錄
 * @returns 依時間新到舊的登入列表
 */
export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)
  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, message: '缺少帳號 id。' })

  const accounts = Storage.get.account()
  if (!accounts[id]) {
    throw createError({ statusCode: 404, message: '找不到該帳號。' })
  }

  return { logins: Storage.manager.admin.loginHistory.list(id) }
})
