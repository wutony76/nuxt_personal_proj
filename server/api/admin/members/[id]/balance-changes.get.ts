import { sessionController } from '../../../../services/auth'
import { memberBalanceHistoryService } from '../../../../services/admin/memberBalanceHistory'

/**
 * 取得會員 F幣變動總表（跨彩種／遊戲）
 * @returns 依時間新到舊的異動列表
 */
export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)
  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, message: '缺少帳號 id。' })

  const changes = memberBalanceHistoryService.list(id)
  return { changes }
})
