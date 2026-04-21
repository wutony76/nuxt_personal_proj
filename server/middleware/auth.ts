import { sessionController } from '../services/auth'

const PROTECTED_PREFIXES = ['/api/lottery', '/api/taiwan-lottery']

export default defineEventHandler((event) => {
  const pathname = getRequestURL(event).pathname
  const method = getMethod(event)

  if (method === 'OPTIONS' || pathname === '/api/login') {
    return
  }

  const isProtectedApi = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  if (!isProtectedApi) {
    return
  }

  sessionController.require(event)
})
