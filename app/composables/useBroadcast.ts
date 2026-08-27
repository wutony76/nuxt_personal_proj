import { computed, reactive } from 'vue'
import { useSocket } from './useSocket'

export type BroadcastToast = {
  id: string
  text: string
  level: 'info' | 'warning' | 'success'
  ts: number
}

const AUTO_DISMISS_MS = 8000

/** module 級單例狀態，比照 useGameHistory.ts 慣例；訂閱只在 client 端註冊一次，不隨元件掛載/卸載重複訂閱 */
const state = reactive({
  toasts: [] as BroadcastToast[]
})

const _actions = {
  dismiss: (id: string) => {
    state.toasts = state.toasts.filter((toast) => toast.id !== id)
  }
}

if (import.meta.client) {
  useSocket().actions.on('system:broadcast', (payload) => {
    const data = payload as { text?: unknown; level?: unknown } | undefined
    const text = typeof data?.text === 'string' ? data.text : ''
    if (!text) return
    const level = data?.level === 'warning' || data?.level === 'success' ? data.level : 'info'
    const toast: BroadcastToast = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      text,
      level,
      ts: Date.now()
    }
    state.toasts = [...state.toasts, toast]
    setTimeout(() => _actions.dismiss(toast.id), AUTO_DISMISS_MS)
  })
}

export const useBroadcast = () => ({
  toasts: computed(() => state.toasts),
  actions: _actions
})
