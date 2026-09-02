import { sessionController } from '../../../services/auth'
import { adminAccessService } from '../../../services/admin/adminAccess'

type Body = {
  password?: unknown
}

/**
 * 重設會員登入密碼
 * @returns 更新後的帳號（不含密碼明文）
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)
  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, message: '缺少帳號 id。' })

  const body = await readBody<Body>(event)
  const password = typeof body?.password === 'string' ? body.password : ''

  const user = adminAccessService.setPassword(id, password)
  return { user }
})
