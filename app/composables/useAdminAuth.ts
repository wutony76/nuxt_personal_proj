import { computed } from 'vue'
import { api, type AuthUser } from '~/services/api'
import { useAuth } from '~/composables/useAuth'

/** 同 useAuth.ts 的設計：用 nuxtApp 實例當 key，SSR 下每個請求各自獨立 */
const checkPromises = new WeakMap<object, Promise<void>>()

/**
 * ⚠️ 狀態改用 useState()，理由與 useAuth.ts 相同——這支只被 admin/Shell.vue 的
 * client-only onMounted 呼叫時，模組層級 reactive({}) 是安全的；Shell.vue 改成
 * SSR 也呼叫後，若不改成 useState，會有不同使用者的管理員身分在同一個 Nitro process
 * 裡互相污染的風險（見 add-ssr-admin-reports-cookie-forward）。
 */
function useAdminAuthState() {
  return useState('admin-auth-state', () => ({
    checked: false as boolean,
    /** 唯讀 demo 角色：不在白名單內，但被指派了 demoMode 角色，可瀏覽後台但打不了寫入端點 */
    isAdmin: false as boolean,
    isDemo: false as boolean,
    user: null as AuthUser | null
  }))
}

export const useAdminAuth = () => {
  const state = useAdminAuthState()
  // ⚠️ 一樣要在這裡（還沒遇到任何 await 之前）就呼叫 useNuxtApp()／useAuth() 並存起來，
  // 不要留到 check() 的 async IIFE 裡才呼叫——那是 await 之後才執行的 continuation，
  // SSR 的 async context 已經跟丟，useNuxtApp() 會直接丟例外（見 useAuth.ts 同一個教訓）。
  const nuxtApp = useNuxtApp()
  const { clearSession } = useAuth()

  /** @param opts.headers SSR 轉發用（useRequestHeaders(['cookie'])），client 端不用帶 */
  const check = async (opts?: { headers?: HeadersInit }) => {
    if (state.value.checked) return
    let promise = checkPromises.get(nuxtApp)
    if (!promise) {
      promise = (async () => {
        try {
          const result = await api.admin.me(opts)
          state.value.isAdmin = result.isAdmin
          state.value.isDemo = result.isDemo
          state.value.user = result.user
        } catch (e: unknown) {
          const statusCode = (e as { statusCode?: number })?.statusCode
          if (statusCode === 401) {
            clearSession()
          }
          state.value.isAdmin = false
          state.value.isDemo = false
          state.value.user = null
        } finally {
          state.value.checked = true
          checkPromises.delete(nuxtApp)
        }
      })()
      checkPromises.set(nuxtApp, promise)
    }
    return promise
  }

  const reset = () => {
    state.value.checked = false
    state.value.isAdmin = false
    state.value.isDemo = false
    state.value.user = null
  }

  return {
    checked: computed(() => state.value.checked),
    isAdmin: computed(() => state.value.isAdmin),
    isDemo: computed(() => state.value.isDemo),
    user: computed(() => state.value.user),
    check,
    reset
  }
}
