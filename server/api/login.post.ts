import { sessionController, verifyUser } from '../services/auth'
import { throwErrCode } from '../utils/error'

type LoginPayload = {
  email?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  const payload = await readBody<LoginPayload>(event)
  // console.log('TTT2.API login.post.payload', payload)
  const email = payload.email?.trim().toLowerCase() ?? ''
  const password = payload.password?.trim() ?? ''

  if (!email || password.length < 6) {
    const message = '請輸入有效 Email 與至少 6 碼密碼。'
    throw createError({ statusCode: 400, message })
  }

  const user = verifyUser(email, password)
  if (!user) throwErrCode(40002)

  sessionController.save(event, user)
  return { user }
})
