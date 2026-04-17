import { requireSessionUser } from '../utils/authSession'

export default defineEventHandler((event) => {
  const user = requireSessionUser(event)
  return { user }
})
