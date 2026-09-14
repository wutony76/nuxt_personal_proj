import { computed, reactive } from 'vue'
import { useSocket } from './useSocket'
import { api, type RetroLeaderboardEntry } from '~/services/api'

/**
 * module 級單例狀態，比照 useBroadcast.ts／useChat.ts 慣例：訂閱只在 client 端註冊一次，
 * 不隨 GameHighScoreHud.vue 掛載/卸載重複訂閱。首次進頁面用 REST 抓一次當前排行榜，
 * 之後任何人在任一款 retro 遊戲送出分數，伺服端都會透過既有的 social socket 推播
 * 最新排行榜（見 server/services/game/retro/retroBroadcast.ts），不用重新整理頁面。
 */
const state = reactive({
  entries: [] as RetroLeaderboardEntry[],
  loading: false,
  error: '',
  loaded: false
})

const _actions = {
  fetch: async () => {
    if (state.loading || state.loaded) return
    state.loading = true
    state.error = ''
    try {
      const result = await api.games.retro.leaderboard()
      state.entries = result.entries
      state.loaded = true
    } catch (error: unknown) {
      const data = (error as { data?: { message?: string } })?.data
      state.error = data?.message ?? '排行榜載入失敗'
    } finally {
      state.loading = false
    }
  }
}

if (import.meta.client) {
  useSocket().actions.on('retro:leaderboard', (payload) => {
    const data = payload as { entries?: RetroLeaderboardEntry[] } | undefined
    if (!Array.isArray(data?.entries)) return
    state.entries = data.entries
    state.loaded = true
    state.error = ''
  })
}

export const useRetroLeaderboard = () => ({
  entries: computed(() => state.entries),
  loading: computed(() => state.loading),
  error: computed(() => state.error),
  loaded: computed(() => state.loaded),
  actions: _actions
})
