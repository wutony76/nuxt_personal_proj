import { computed } from 'vue'

type AuthUser = {
  id: number
  name: string
  email: string
}

type LoginResponse = {
  user: AuthUser
}

type MeResponse = {
  user: AuthUser
}

export const useAuth = () => {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const initialized = useState<boolean>('auth-initialized', () => false)

  const init = async () => {
    if (initialized.value) {
      return
    }

    try {
      const result = await $fetch<MeResponse>('/api/me')
      user.value = result.user
    } catch {
      user.value = null
    } finally {
      initialized.value = true
    }
  }

  const login = async (email: string, password: string) => {
    await init()

    try {
      const result = await $fetch<LoginResponse>('/api/login', {
        method: 'POST',
        body: {
          email,
          password
        }
      })

      user.value = result.user

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
      await $fetch('/api/logout', {
        method: 'POST'
      })
    } finally {
      user.value = null
      initialized.value = true
    }
  }

  const isLoggedIn = computed(() => Boolean(user.value))

  return {
    user,
    initialized,
    isLoggedIn,
    init,
    login,
    logout
  }
}
