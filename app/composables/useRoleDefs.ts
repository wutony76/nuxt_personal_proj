import { computed, reactive } from 'vue'
import { api, type RoleDef } from '~/services/api'

/**
 * 角色清單單例 reactive 狀態，比照 useAdminAuth.ts：
 * AccessPanel／CreateMember／RoleList 共用同一份角色清單，不用各自重打 API。
 */
const state = reactive({
  status: 'idle' as 'idle' | 'loading' | 'success' | 'error',
  roles: [] as RoleDef[]
})

let fetchPromise: Promise<void> | null = null

const _load = async () => {
  if (!fetchPromise) {
    fetchPromise = (async () => {
      state.status = 'loading'
      try {
        const res = await api.admin.roleDefs()
        state.roles = res.roles
        state.status = 'success'
      } catch {
        state.status = 'error'
      } finally {
        fetchPromise = null
      }
    })()
  }
  return fetchPromise
}

export const useRoleDefs = () => {
  const fetch = async () => {
    if (state.status === 'success') return
    return _load()
  }

  const refresh = async () => _load()

  return {
    status: computed(() => state.status),
    roles: computed(() => state.roles),
    fetch,
    refresh
  }
}
