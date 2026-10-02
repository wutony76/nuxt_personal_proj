import { computed } from 'vue'
import { type AuthUser } from '~/services/api'
import { AuthService } from '~/services/authService'
import { useSocket } from './useSocket'
import { useGameAccess } from './useGameAccess'

const authService = new AuthService()

/**
 * `init()`/`refresh()` 進行中的 promise，用 WeakMap 以當下的 nuxtApp 實例當 key——
 * SSR 時每個請求都是全新的 nuxtApp 實例（天生各自獨立，不會跨請求共用到別人進行中的
 * promise），client 端整個 session 共用同一個 nuxtApp 實例（維持原本「多個元件同時
 * mount 只打一次 /api/me」的去重效果）。不能用模組層級的 `let`：那樣 SSR 下會變成
 * 全部請求共用同一個 promise 參考，等於跨使用者共用登入狀態查詢結果。
 */
const initPromises = new WeakMap<object, Promise<void>>()

/**
 * ⚠️ 狀態改用 useState()（Nuxt SSR-safe 的共用 reactive state），不是模組層級的
 * `reactive({})`——後者在 SSR 下是整個 Nitro process 共用一份，若被多個使用者的請求
 * 同時讀寫，會有 session 互相污染的風險（這支 composable 一直以來都只被 client-only
 * 的 onMounted 呼叫，所以這個風險目前是潛在、未觸發的；app/components/admin/Shell.vue
 * 改成 SSR 也呼叫這支 composable 後，必須先把這裡改安全，否則就是真的會在 SSR 製造出
 * 跨使用者外洩的洞，見 add-ssr-admin-reports-cookie-forward）。useState 在 server 端
 * 每個請求各自獨立、client 端維持整個 app 生命週期共用同一份，語意跟原本的模組單例
 * 對 client 端呼叫者完全一致，對外的 user/isLoggedIn/initialized 等介面也完全不變。
 */
function useAuthState() {
  return useState('auth-state', () => ({
    user: null as AuthUser | null,
    init: false as boolean,
  }))
}

export const useAuth = () => {
  const state = useAuthState()
  // ⚠️ 一定要在這裡（函式最頂層、還沒遇到任何 await 之前）就呼叫一次 useNuxtApp() 並存起來，
  // 不要在 init()/refresh() 的 finally 區塊裡才呼叫——那些區塊是在 await 之後才執行，
  // SSR 的 async context 這時候已經跟丟了，useNuxtApp() 會直接丟例外（已實測確認）。
  // useAuth() 本身保證只會在 setup 同步階段被呼叫，這裡捕捉到的永遠是正確的 nuxtApp。
  const nuxtApp = useNuxtApp()

  /**
   * @param opts.headers SSR 階段轉發原始請求 cookie 用（useRequestHeaders(['cookie'])）；
   *   client 端呼叫一律不用帶，瀏覽器同源請求本來就會自動帶 cookie
   */
  const init = async (opts?: { headers?: HeadersInit }) => {
    if (state.value.init) return
    let promise = initPromises.get(nuxtApp)
    if (!promise) {
      promise = (async () => {
        try {
          const result = await authService.fetchMe(opts)
          state.value.user = result.user
        } catch {
          state.value.user = null
        } finally {
          state.value.init = true
          initPromises.delete(nuxtApp)
        }
      })()
      initPromises.set(nuxtApp, promise)
    }
    return promise
  }

  /**
   * 重新向伺服器確認 session（後台進入時用，避免 cookie 已過期但 client 仍快取登入態）。
   * @param opts.headers 同 init()
   */
  const refresh = async (opts?: { headers?: HeadersInit }) => {
    try {
      const result = await authService.fetchMe(opts)
      state.value.user = result.user
    } catch {
      state.value.user = null
    } finally {
      state.value.init = true
      initPromises.delete(nuxtApp)
    }
  }

  const clearSession = () => {
    state.value.user = null
    state.value.init = true
    initPromises.delete(nuxtApp)
    useGameAccess().refresh()
  }

  const login = async (email: string, password: string) => {
    await init()
    try {
      const result = await authService.submitLogin({ email, password })
      state.value.user = result.user
      // WebSocket 身分是握手當下的 cookie 決定的，登入前就連上的連線不會自動變成已登入，見 useSocket.ts reconnect() 註解
      useSocket().actions.reconnect()
      // 角色可能剛好被切換過，登入後重查一次遊戲權限，避免沿用前一個訪客/角色的快取（見 useGameAccess.ts）
      useGameAccess().refresh()
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
      state.value.user = null
      state.value.init = false
      initPromises.delete(nuxtApp)
      useGameAccess().refresh()
    }
  }

  const user = computed(() => state.value.user)
  const initialized = computed(() => state.value.init)
  const isLoggedIn = computed(() => Boolean(state.value.user))

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
