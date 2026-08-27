import { computed, reactive } from 'vue'
import { useSocket } from './useSocket'

export type ChatMessage = {
  id: string
  userId: string
  userName: string
  text: string
  ts: number
}

const MAX_MESSAGES = 50
/** 前端節流只是 UX 優化（避免手滑連點），真正的防護在 server 端 chatService.handleSend() */
const CLIENT_THROTTLE_MS = 1500

const state = reactive({
  messages: [] as ChatMessage[],
  errorMessage: ''
})

let lastSentAt = 0

if (import.meta.client) {
  const socket = useSocket()
  socket.actions.on('chat:history', (payload) => {
    const data = payload as { messages?: ChatMessage[] } | undefined
    state.messages = Array.isArray(data?.messages) ? data.messages.slice(-MAX_MESSAGES) : []
  })
  socket.actions.on('chat:message', (payload) => {
    const message = payload as ChatMessage
    if (!message?.id) return
    state.messages = [...state.messages, message].slice(-MAX_MESSAGES)
  })
  socket.actions.on('error', (payload) => {
    const data = payload as { message?: string } | undefined
    if (typeof data?.message === 'string') state.errorMessage = data.message
  })
}

const _actions = {
  /** loading guard 用「前端節流窗口內直接忽略」取代，聊天室不需要 loading 狀態（單向 fire-and-forget） */
  sendMessage: (text: string) => {
    state.errorMessage = ''
    const trimmed = text.trim()
    if (!trimmed) return
    const now = Date.now()
    if (now - lastSentAt < CLIENT_THROTTLE_MS) return
    lastSentAt = now
    useSocket().actions.send('chat:send', { text: trimmed })
  }
}

export const useChat = () => {
  const socket = useSocket()
  return {
    messages: computed(() => state.messages),
    errorMessage: computed(() => state.errorMessage),
    onlineCount: computed(() => socket.state.onlineCount),
    connected: computed(() => socket.state.connected),
    actions: _actions
  }
}
