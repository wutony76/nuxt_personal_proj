import { computed, reactive } from 'vue'
import { api, type AuthUser } from '~/services/api'

/**
 * 是否為管理員的檢查結果，比照 useAuth.ts 的單例 reactive 模式：
 * Shell.vue（admin/）只需要打一次 GET /api/admin/me，其他共用同一份結果，不用每個後台頁面各自重打。
 */
const state = reactive({
  checked: false as boolean,
  isAdmin: false as boolean,
  user: null as AuthUser | null
})

let checkPromise: Promise<void> | null = null

export const useAdminAuth = () => {
  const check = async () => {
    if (state.checked) return
    if (!checkPromise) {
      checkPromise = (async () => {
        try {
          const result = await api.admin.me()
          state.isAdmin = result.isAdmin
          state.user = result.user
        } catch {
          state.isAdmin = false
          state.user = null
        } finally {
          state.checked = true
          checkPromise = null
        }
      })()
    }
    return checkPromise
  }

  const reset = () => {
    state.checked = false
    state.isAdmin = false
    state.user = null
    checkPromise = null
  }

  return {
    checked: computed(() => state.checked),
    isAdmin: computed(() => state.isAdmin),
    user: computed(() => state.user),
    check,
    reset
  }
}
