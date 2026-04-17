import { clearAuthSession } from '../utils/authSession'

export default defineEventHandler((event) => {
  clearAuthSession(event)
  return { ok: true }
})
