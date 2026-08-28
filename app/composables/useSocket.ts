import { reactive } from 'vue'

type SocketHandler = (payload: unknown) => void
type SocketEnvelope = { type?: string; payload?: unknown; ts?: number }

const MAX_BACKOFF_MS = 30_000

/**
 * 全站唯一的 WebSocket 連線單例（module 級 state，比照 useEggs.ts 的 pollTimer 慣例）。
 * 只在 app.vue 的 onMounted 呼叫一次 actions.connect()，其餘 composable（useBroadcast/useChat）
 * 透過 actions.on(type, handler) 訂閱，不各自建立連線。
 */
const state = reactive({
  connected: false,
  onlineCount: 0
})

let ws: WebSocket | null = null
let reconnectAttempts = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
const handlers = new Map<string, Set<SocketHandler>>()

const _handlers = {
  dispatch: (type: string, payload: unknown) => {
    handlers.get(type)?.forEach((handler) => handler(payload))
  },
  scheduleReconnect: () => {
    if (reconnectTimer) return
    const delay = Math.min(1000 * 2 ** reconnectAttempts, MAX_BACKOFF_MS)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      reconnectAttempts += 1
      _actions.connect()
    }, delay)
  },
  handleMessage: (event: MessageEvent) => {
    let envelope: SocketEnvelope
    try {
      envelope = JSON.parse(event.data)
    } catch {
      return
    }
    if (envelope.type === 'ping') {
      _actions.send('pong', {})
      return
    }
    if (envelope.type === 'chat:online') {
      state.onlineCount = Number((envelope.payload as { count?: number } | undefined)?.count ?? 0)
    }
    if (envelope.type) _handlers.dispatch(envelope.type, envelope.payload)
  }
}

const _actions = {
  connect: () => {
    if (!import.meta.client) return
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/ws/social`)
    ws = socket

    socket.addEventListener('open', () => {
      state.connected = true
      reconnectAttempts = 0
    })
    socket.addEventListener('message', _handlers.handleMessage)
    socket.addEventListener('close', () => {
      // 這條連線已經被 reconnect() 取代（不是目前追蹤的 ws），代表是主動關閉，不是意外斷線，不用處理
      if (ws !== socket) return
      state.connected = false
      ws = null
      _handlers.scheduleReconnect()
    })
    socket.addEventListener('error', () => {
      socket.close()
    })
  },
  send: (type: string, payload: unknown) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type, payload, ts: Date.now() }))
  },
  on: (type: string, handler: SocketHandler) => {
    if (!handlers.has(type)) handlers.set(type, new Set())
    handlers.get(type)!.add(handler)
  },
  off: (type: string, handler: SocketHandler) => {
    handlers.get(type)?.delete(handler)
  },
  /**
   * 強制斷線重連：WebSocket 的身分是握手當下的 cookie 決定的，連線活著就不會自動更新。
   * 登入成功後如果不重連，舊連線會一直被當成訪客（伺服端每次送出都重查也沒用，
   * 因為查的是同一個已經凍結的 HTTP request，不是當下瀏覽器的 cookie）。
   */
  reconnect: () => {
    reconnectAttempts = 0
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws) {
      const stale = ws
      ws = null
      try {
        stale.close()
      } catch {
        // 忽略，反正要丟棄這條連線
      }
    }
    _actions.connect()
  }
}

export const useSocket = () => ({
  state,
  actions: _actions
})
