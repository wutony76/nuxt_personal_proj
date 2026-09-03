import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/**
 * 取得會員 F幣變動總表（跨彩種／遊戲）
 * @returns 依時間新到舊的異動列表
 */
export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)
  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, message: '缺少帳號 id。' })

  const changes = Storage.manager.admin.balanceHistory.list(id)
  return { changes }
})
