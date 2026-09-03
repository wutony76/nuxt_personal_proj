import type { Peer } from 'crossws'
import type { AuthUser } from '../../types/storage'
import { socketAuth } from '../../utils/socketAuth'
import { chatService } from './chatService'

type PeerInfo = {
  peer: Peer
  user: AuthUser | null
  lastPong: number
}

/** 全域單一心跳計時器，不是每條連線各開一個（見 add-socket-social design.md 對策②） */
const HEARTBEAT_INTERVAL_MS = 30_000
const HEARTBEAT_TIMEOUT_MS = 60_000

const registry = new Map<string, PeerInfo>()
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

function safeSend(peer: Peer, type: string, payload: unknown) {
  try {
    peer.send(JSON.stringify({ type, payload, ts: Date.now() }))
  } catch {
    // 對方連線可能已經在送出當下關閉，忽略即可，不影響其他連線
  }
}

/**
 * WebSocket 連線註冊表、心跳保活、廣播。跟遊戲引擎／彩票結算同一個 Nitro process，
 * 所有對外方法內部都不假設輸入必然合法（縱深防禦）；真正的例外邊界攔截在 server/api/ws/social.ts
 * （見 add-socket-social design.md 對策①，那裡才是唯一會讓例外「有機會」往上炸穿的地方）。
 */
export const socketHub = {
  /** server boot 時呼叫一次（比照 Storage.init() 的既有慣例），確保心跳計時器在第一個連線進來前就存在 */
  init: () => {
    if (heartbeatTimer) return
    heartbeatTimer = setInterval(() => {
      const now = Date.now()
      for (const [id, info] of registry) {
        if (now - info.lastPong > HEARTBEAT_TIMEOUT_MS) {
          registry.delete(id)
          try {
            info.peer.close()
          } catch {
            // 連線可能已經斷了，忽略
          }
          socketHub.broadcast('chat:online', { count: registry.size })
          continue
        }
        safeSend(info.peer, 'ping', {})
      }
    }, HEARTBEAT_INTERVAL_MS)
    console.log('SUCCESS ---SOCIAL>socketHub.init')
  },

  broadcast: (type: string, payload: unknown) => {
    for (const info of registry.values()) {
      safeSend(info.peer, type, payload)
    }
  },

  onlineCount: (): number => registry.size,

  onOpen: (peer: Peer) => {
    const user = socketAuth.identify(peer)
    registry.set(peer.id, { peer, user, lastPong: Date.now() })
    safeSend(peer, 'chat:history', { messages: chatService.recent() })
    socketHub.broadcast('chat:online', { count: registry.size })
  },

  onMessage: (peer: Peer, rawText: string) => {
    let envelope: { type?: unknown; payload?: unknown }
    try {
      envelope = JSON.parse(rawText)
    } catch {
      safeSend(peer, 'error', { code: 'bad_request', message: '訊息格式錯誤' })
      return
    }

    if (envelope.type === 'pong') {
      const info = registry.get(peer.id)
      if (info) info.lastPong = Date.now()
      return
    }

    if (envelope.type === 'chat:send') {
      const rawPayload = envelope.payload as { text?: unknown; asAdmin?: unknown } | undefined
      const text = typeof rawPayload?.text === 'string' ? rawPayload.text : ''
      const asAdmin = rawPayload?.asAdmin === true
      const result = chatService.handleSend(peer, text, { asAdmin })
      if (!result.ok) {
        safeSend(peer, 'error', { code: result.code, message: result.message })
        return
      }
      socketHub.broadcast('chat:message', result.message)
      return
    }

    safeSend(peer, 'error', { code: 'unknown_type', message: `未知的訊息類型：${String(envelope.type)}` })
  },

  onClose: (peer: Peer) => {
    if (!registry.has(peer.id)) return
    registry.delete(peer.id)
    socketHub.broadcast('chat:online', { count: registry.size })
  }
}
