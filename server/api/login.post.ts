import { sessionController, verifyUser } from '../services/auth'
import { STATUS_ERR_CODE } from '~/config/constants.js'

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
    throw createError({
      statusCode: -1,
      statusMessage: '請輸入有效 Email 與至少 6 碼密碼。'
    })
  }

  const user = verifyUser(email, password)
  if (!user) {
    throw createError({
      statusCode: STATUS_ERR_CODE[40002].code,
      statusMessage: STATUS_ERR_CODE[40002].message,
    })
  }

  sessionController.save(event, user)
  return { user }
})
