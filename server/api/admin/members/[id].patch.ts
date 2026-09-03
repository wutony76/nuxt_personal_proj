import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

type Body = {
  password?: unknown
  email?: unknown
  coinDelta?: unknown
}

/**
 * 更新會員 Email、重設登入密碼或調整 F幣
 * @returns 更新後的帳號（不含密碼明文）
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)
  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, message: '缺少帳號 id。' })

  const body = await readBody<Body>(event)
  const hasEmail = typeof body?.email === 'string'
  const hasPassword = typeof body?.password === 'string'
  const hasCoinDelta = body?.coinDelta !== undefined && body?.coinDelta !== null

  if (!hasEmail && !hasPassword && !hasCoinDelta) {
    throw createError({ statusCode: 400, message: '請提供 email、password 或 coinDelta。' })
  }

  const access = Storage.manager.admin.access
  let user = null as ReturnType<typeof access.setEmail> | null
  if (hasEmail) {
    user = access.setEmail(id, body.email as string)
  }
  if (hasPassword) {
    user = access.setPassword(id, body.password as string)
  }
  if (hasCoinDelta) {
    user = access.adjustCoin(id, Number(body.coinDelta))
  }

  return { user: user! }
})
