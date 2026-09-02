import { computed } from 'vue'
import { type AuthUser } from '~/services/api'
import { AuthService } from '~/services/authService'
import { useSocket } from './useSocket'

const state = reactive({
  user: null as AuthUser | null,
  init: false as boolean,
})

const authService = new AuthService()
let initPromise: Promise<void> | null = null

export const useAuth = () => {
  const init = async () => {
    if (state.init) return
    if (!initPromise) {
      initPromise = (async () => {
        try {
          const result = await authService.fetchMe()
          state.user = result.user
        } catch {
          state.user = null
        } finally {
          state.init = true
          initPromise = null
        }
      })()
    }
    return initPromise
  }

  /**
   * 重新向伺服器確認 session（後台進入時用，避免 cookie 已過期但 client 仍快取登入態）。
   */
  const refresh = async () => {
    try {
      const result = await authService.fetchMe()
      state.user = result.user
    } catch {
      state.user = null
    } finally {
      state.init = true
      initPromise = null
    }
  }

  const clearSession = () => {
    state.user = null
    state.init = true
    initPromise = null
  }

  const login = async (email: string, password: string) => {
    await init()
    try {
      const result = await authService.submitLogin({ email, password })
      state.user = result.user
      // WebSocket 身分是握手當下的 cookie 決定的，登入前就連上的連線不會自動變成已登入，見 useSocket.ts reconnect() 註解
      useSocket().actions.reconnect()
      return { ok: true, message: '' }
    } catch (error: unknown) {
      const fallbackMessage = '登入失敗，請稍後再試。'
      // 文案一律讀 message：statusMessage 是 HTTP reason phrase，h3 會把中文消毒成空字串
      const data = (error as { data?: { message?: string; statusMessage?: string } })?.data
      return {
        ok: false,
        message: data?.message || data?.statusMessage || fallbackMessage
      }
    }
  }

  const logout = async () => {
    try {
      await authService.submitLogout()
    } finally {
      state.user = null
      state.init = false
      initPromise = null
    }
  }

  const user = computed(() => state.user)
  const initialized = computed(() => state.init)
  const isLoggedIn = computed(() => Boolean(state.user))

  return {
    user,
    initialized,
    isLoggedIn,
    init,
    refresh,
    clearSession,
    login,
    logout
  }
}
