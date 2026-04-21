import { sessionController } from '../services/auth'

export default defineEventHandler((event) => {
  sessionController.clear(event)
  return { ok: true }
})
