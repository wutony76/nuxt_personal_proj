import { verifyUserCredentials } from '../utils/mockAuthDb'
import { issueSession } from '../utils/authSession'

type LoginPayload = {
  email?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  const payload = await readBody<LoginPayload>(event)

  const email = payload.email?.trim().toLowerCase() ?? ''
  const password = payload.password?.trim() ?? ''

  if (!email || password.length < 6) {
    throw createError({
      statusCode: 400,
      statusMessage: '請輸入有效 Email 與至少 6 碼密碼。'
    })
  }

  const user = verifyUserCredentials(email, password)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: '帳號或密碼錯誤。'
    })
  }

  issueSession(event, user)

  return { user }
})
