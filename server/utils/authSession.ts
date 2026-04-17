import type { H3Event } from 'h3'
import type { AuthUser } from './mockAuthDb'
import { Storage } from '../services/storage'

const SESSION_COOKIE_NAME = 'portfolio_auth_token'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

const isProduction = ((globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV ?? '') === 'production'

const getCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: isProduction,
  path: '/',
  maxAge: SESSION_TTL_SECONDS
})

export const issueSession = (event: H3Event, user: AuthUser) => {
  const token = globalThis.crypto.randomUUID()
  const store = Storage.getAuthSessionStore()
  store.set(token, {
    user,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000
  })
  setCookie(event, SESSION_COOKIE_NAME, token, getCookieOptions())
}

export const clearAuthSession = (event: H3Event) => {
  const token = getCookie(event, SESSION_COOKIE_NAME)
  if (token) {
    Storage.getAuthSessionStore().delete(token)
  }
  deleteCookie(event, SESSION_COOKIE_NAME, {
    path: '/'
  })
}

export const getSessionUser = (event: H3Event): AuthUser | null => {
  const token = getCookie(event, SESSION_COOKIE_NAME)
  if (!token) {
    return null
  }

  const store = Storage.getAuthSessionStore()
  const session = store.get(token)
  if (!session) {
    return null
  }

  if (session.expiresAt < Date.now()) {
    store.delete(token)
    return null
  }

  return session.user
}

export const requireSessionUser = (event: H3Event): AuthUser => {
  const user = getSessionUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: '尚未登入或登入已過期。'
    })
  }
  return user
}
