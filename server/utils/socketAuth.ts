import { Storage } from '../services/storage'
import type { AuthUser } from '../types/storage'

const SESSION_COOKIE_NAME = 'portfolio_auth_token'

/** crossws 的 peer 不是 H3Event，sessionController.get() 用不了，這裡手動解析 cookie 字串 */
function parseCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim()
    if (key !== name) continue
    try {
      return decodeURIComponent(part.slice(eq + 1).trim())
    } catch {
      return part.slice(eq + 1).trim()
    }
  }
  return null
}

type PeerLike = { request?: { headers?: { get?: (name: string) => string | null } } }

/**
 * WebSocket 連線的身分辨識，跟 sessionController 查同一份 Storage.get.sessions()，
 * 但入口不同（peer.request 而非 H3Event）。刻意獨立一支檔案，不動 auth.ts。
 */
export const socketAuth = {
  identify: (peer: PeerLike): AuthUser | null => {
    const cookieHeader = peer.request?.headers?.get?.('cookie') ?? null
    const token = parseCookie(cookieHeader, SESSION_COOKIE_NAME)
    if (!token) return null
    const store = Storage.get.sessions()
    const session = store.get(token)
    if (!session) return null
    if (session.expiresAt < Date.now()) {
      store.delete(token)
      return null
    }
    return session.user
  }
}
