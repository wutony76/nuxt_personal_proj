import { computed, reactive } from 'vue'
import { api, type GameCategory } from '~/services/api'

type Status = 'idle' | 'loading' | 'success' | 'error'
type AccessEntry = { category: GameCategory; key: string }

/**
 * 目前登入者的角色被關閉的遊戲／盤口單例快取，比照 useRoleDefs.ts。
 * 未登入或查詢失敗一律視為「無限制」（訪客沿用現況、不擋前台，見
 * openspec/changes/add-role-game-perms/design.md Decision 4）。
 */
const state = reactive({
  status: 'idle' as Status,
  disabled: [] as AccessEntry[]
})

let fetchPromise: Promise<void> | null = null

const _load = async () => {
  if (!fetchPromise) {
    fetchPromise = (async () => {
      state.status = 'loading'
      try {
        const res = await api.games.access()
        state.disabled = res.disabled
        state.status = 'success'
      } catch {
        state.disabled = []
        state.status = 'success'
      } finally {
        fetchPromise = null
      }
    })()
  }
  return fetchPromise
}

export const useGameAccess = () => {
  const fetch = async () => {
    if (state.status === 'success') return
    return _load()
  }

  const refresh = async () => _load()

  const isDisabled = (category: GameCategory, key: string): boolean =>
    state.disabled.some((d) => d.category === category && d.key === key)

  return {
    status: computed(() => state.status),
    disabled: computed(() => state.disabled),
    fetch,
    refresh,
    isDisabled
  }
}
