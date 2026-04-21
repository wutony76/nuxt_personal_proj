import { sessionController } from '../services/auth'

export default defineEventHandler((event) => {
  const user = sessionController.require(event)
  return { user }
})
