import { sessionController, verifyUser } from '../services/auth'
import { loginHistoryService } from '../services/loginHistory'
import { throwErrCode } from '../utils/error'

type LoginPayload = {
  email?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  const payload = await readBody<LoginPayload>(event)
  // console.log('TTT2.API login.post.payload', payload)
  const email = payload.email?.trim().toLowerCase() ?? ''
  // 前端送來的 password 已經是 encodePassword(password, email) 雜湊過的值（見 app/services/api.ts），
  // 不再是使用者輸入的明文，所以這裡不再檢查「至少 6 碼」這種明文強度規則——原始密碼長度驗證
  // 已經下放到前端表單（送出前、雜湊前）去做。
  const password = payload.password?.trim() ?? ''

  if (!email || !password) {
    const message = '請輸入有效 Email 與密碼。'
    throw createError({ statusCode: 400, message })
  }

  const user = verifyUser(email, password)
  if (!user) throwErrCode(40002)

  loginHistoryService.record(event, user)
  sessionController.save(event, user)
  return { user }
})
