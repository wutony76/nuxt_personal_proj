import type { H3Event } from 'h3'
import { Storage, verifyPasswordHash } from './storage'
import type { AuthUser } from '../types/storage'
import { STATUS_ERR_CODE } from '~/config/constants.js'

const SESSION_COOKIE_NAME = 'portfolio_auth_token'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

const isProduction = (
  (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV ?? ''
) === 'production'

const getCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: isProduction,
  path: '/',
  maxAge: SESSION_TTL_SECONDS
})

export const verifyUser = (email: string, password: string): AuthUser | null => {
  const normalizedEmail = email.trim().toLowerCase()
  const row = Object.values(Storage.get.account()).find((item) => item.email === normalizedEmail)
  if (!row) return null
  const isValid = verifyPasswordHash(password, row.passwordHash)
  if (!isValid) return null

  return {
    id: row.id,
    name: row.name,
    email: row.email
    // token: globalThis.crypto.randomUUID() as string
  }
}

// Controller
export const sessionController = {
  require: (event: H3Event): AuthUser => {
    const user = sessionController.get(event)
    if (!user) {
      throw createError({
        statusCode: STATUS_ERR_CODE[40001].code,
        statusMessage: STATUS_ERR_CODE[40001].message,
      })
    }
    return user
  },
  save: (event: H3Event, user: AuthUser) => {
    const token = globalThis.crypto.randomUUID()
    const store = Storage.get.sessions()
    store.set(token, {
      user,
      expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000
    })
    setCookie(event, SESSION_COOKIE_NAME, token, getCookieOptions())
  },
  get: (event: H3Event): AuthUser | null => {
    const token = getCookie(event, SESSION_COOKIE_NAME)
    if (!token) return null
    const store = Storage.get.sessions()
    const session = store.get(token)
    if (!session) return null
    if (session.expiresAt < Date.now()) {
      store.delete(token)
      return null
    }
    return session.user
  },
  clear: (event: H3Event) => {
    const token = getCookie(event, SESSION_COOKIE_NAME)
    if (token) Storage.get.sessions().delete(token)
    deleteCookie(event, SESSION_COOKIE_NAME, { path: '/' })
  }
}
