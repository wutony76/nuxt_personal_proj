import { computed, reactive } from 'vue'
import { useAuth } from './useAuth'
import { api, type GameHistoryRecord, type GameHistoryRecordPayload, type RetroGameKey } from '~/services/api'

const LOCAL_STORAGE_KEY = 'game-history-v1'
const MAX_LOCAL_RECORDS = 50

type RecordActionResult = {
  coinReward: number
  coinCapped: boolean
}

const state = reactive({
  records: [] as GameHistoryRecord[],
  loaded: false,
  loading: false
})

let loadPromise: Promise<void> | null = null

/** 私有工具方法：localStorage 讀寫（模式 A）與各遊戲 API 對照表 */
const _handlers = {
  loadLocal: (): GameHistoryRecord[] => {
    if (!import.meta.client) return []
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as GameHistoryRecord[]) : []
    } catch {
      return []
    }
  },
  persistLocal: (records: GameHistoryRecord[]) => {
    if (!import.meta.client) return
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records.slice(-MAX_LOCAL_RECORDS)))
    } catch {
      // 私密瀏覽模式等場景 localStorage 可能不可用，靜默略過，不影響遊戲本身
    }
  },
  createLocalRecord: (gameKey: RetroGameKey, gameName: string, payload: GameHistoryRecordPayload): GameHistoryRecord => ({
    id: `${gameKey}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    gameKey,
    gameName,
    score: payload.score,
    ...(payload.level !== undefined ? { level: payload.level } : {}),
    ...(payload.meta ? { meta: payload.meta } : {}),
    playedAt: new Date().toISOString()
  }),
  gameApi: (gameKey: RetroGameKey) => {
    if (gameKey === 'snake') {
      return { history: api.games.retro.historySnake, record: api.games.retro.recordSnake, clear: api.games.retro.clearSnake }
    }
    if (gameKey === 'racing') {
      return { history: api.games.retro.historyRacing, record: api.games.retro.recordRacing, clear: api.games.retro.clearRacing }
    }
    if (gameKey === 'tetriminos') {
      return { history: api.games.retro.historyTetriminos, record: api.games.retro.recordTetriminos, clear: api.games.retro.clearTetriminos }
    }
    if (gameKey === 'match3rush') {
      return { history: api.games.retro.historyMatch3Rush, record: api.games.retro.recordMatch3Rush, clear: api.games.retro.clearMatch3Rush }
    }
    if (gameKey === 'match3classic') {
      return { history: api.games.retro.historyMatch3Classic, record: api.games.retro.recordMatch3Classic, clear: api.games.retro.clearMatch3Classic }
    }
    if (gameKey === 'pong') {
      return { history: api.games.retro.historyPong, record: api.games.retro.recordPong, clear: api.games.retro.clearPong }
    }
    if (gameKey === 'runner') {
      return { history: api.games.retro.historyRunner, record: api.games.retro.recordRunner, clear: api.games.retro.clearRunner }
    }
    return { history: api.games.retro.historySpaceShooter, record: api.games.retro.recordSpaceShooter, clear: api.games.retro.clearSpaceShooter }
  }
}

const GAME_KEYS: RetroGameKey[] = ['snake', 'racing', 'tetriminos', 'match3rush', 'match3classic', 'pong', 'runner', 'spaceShooter']

export const useGameHistory = () => {
  const { isLoggedIn, init: initAuth, user } = useAuth()

  const load = async () => {
    state.loading = true
    try {
      await initAuth()
      if (isLoggedIn.value) {
        const results = await Promise.all(GAME_KEYS.map((key) => _handlers.gameApi(key).history()))
        state.records = results.flatMap((r) => r.records)
      } else {
        state.records = _handlers.loadLocal()
      }
      state.loaded = true
    } finally {
      state.loading = false
    }
  }

  const ensureLoaded = async () => {
    if (state.loaded) return
    if (!loadPromise) {
      loadPromise = load().finally(() => {
        loadPromise = null
      })
    }
    return loadPromise
  }

  const actions = {
    /** 單局明確結束（gameover／通關）時呼叫；暫停或離開頁面不應呼叫此方法 */
    record: async (gameKey: RetroGameKey, gameName: string, payload: GameHistoryRecordPayload): Promise<RecordActionResult> => {
      await initAuth()
      if (isLoggedIn.value) {
        const result = await _handlers.gameApi(gameKey).record(payload)
        if (result.record) state.records = [...state.records, result.record]
        return { coinReward: result.coinReward, coinCapped: result.coinCapped }
      }
      const record = _handlers.createLocalRecord(gameKey, gameName, payload)
      const next = [..._handlers.loadLocal(), record].slice(-MAX_LOCAL_RECORDS)
      _handlers.persistLocal(next)
      state.records = next
      return { coinReward: 0, coinCapped: false }
    },
    clear: async () => {
      await initAuth()
      if (isLoggedIn.value) {
        await Promise.all(GAME_KEYS.map((key) => _handlers.gameApi(key).clear()))
      } else {
        _handlers.persistLocal([])
      }
      state.records = []
    },
    reload: () => {
      state.loaded = false
      return ensureLoaded()
    }
  }

  const recordsSorted = computed(() => [...state.records].sort((a, b) => b.playedAt.localeCompare(a.playedAt)))

  const statsByGame = computed(() => {
    const map: Partial<Record<RetroGameKey, { best: number; count: number }>> = {}
    state.records.forEach((r) => {
      const cur = map[r.gameKey] ?? { best: 0, count: 0 }
      map[r.gameKey] = { best: Math.max(cur.best, r.score), count: cur.count + 1 }
    })
    return map
  })

  const identityLabel = computed(() => (isLoggedIn.value ? `會員 ${user.value?.name ?? ''}` : '訪客（本機保存）'))

  return {
    records: recordsSorted,
    statsByGame,
    identityLabel,
    loaded: computed(() => state.loaded),
    loading: computed(() => state.loading),
    ensureLoaded,
    actions
  }
}
