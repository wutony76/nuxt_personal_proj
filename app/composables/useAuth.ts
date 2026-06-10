import { computed } from 'vue'
import { type AuthUser } from '~/services/api'
import { AuthService } from '~/services/authService'

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

  const login = async (email: string, password: string) => {
    await init()
    try {
      const result = await authService.submitLogin({ email, password })
      state.user = result.user
      return { ok: true, message: '' }
    } catch (error: unknown) {
      const fallbackMessage = '登入失敗，請稍後再試。'
      const data = (error as { data?: { statusMessage?: string } })?.data
      return {
        ok: false,
        message: data?.statusMessage || fallbackMessage
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
    login,
    logout
  }
}
