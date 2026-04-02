import { computed } from 'vue'

type AuthUser = {
  name: string
  email: string
}

const STORAGE_KEY = 'portfolio-auth-user'

export const useAuth = () => {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const initialized = useState<boolean>('auth-initialized', () => false)

  const init = () => {
    if (!import.meta.client || initialized.value) {
      return
    }

    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        user.value = JSON.parse(raw) as AuthUser
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }

    initialized.value = true
  }

  const login = (email: string, password: string) => {
    init()
    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail || password.trim().length < 6) {
      return {
        ok: false,
        message: '請輸入有效 Email 與至少 6 碼密碼。'
      }
    }

    const name = cleanEmail.split('@')[0] || 'User'
    const nextUser: AuthUser = { name, email: cleanEmail }

    user.value = nextUser
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser))
    }

    return { ok: true, message: '' }
  }

  const logout = () => {
    user.value = null
    if (import.meta.client) {
      localStorage.removeItem(STORAGE_KEY)
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
