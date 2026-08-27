import type { Peer } from 'crossws'
import { socketAuth } from '../../utils/socketAuth'

export type ChatMessage = {
  id: string
  userId: string
  userName: string
  text: string
  ts: number
}

type SendResult =
  | { ok: true; message: ChatMessage }
  | { ok: false; code: string; message: string }

const MAX_HISTORY = 50
const MAX_TEXT_LENGTH = 200
const RATE_LIMIT_MS = 1500

const history: ChatMessage[] = []
/** userId -> 最後一次成功送出的時間戳，server 端 rate limit 用，不能只信前端節流 */
const lastSentAt = new Map<string, number>()

/**
 * 聊天訊息驗證與記憶體歷史（ring buffer，上限 50 筆）。
 * 刻意不 import socketHub——避免循環依賴，handleSend() 只回傳結果，
 * 由呼叫端（socketHub.onMessage）決定要不要廣播，維持單向依賴。
 */
export const chatService = {
  recent: (): ChatMessage[] => [...history],

  /**
   * 每次送出都重新查驗身分（見 add-socket-social design.md 對策③），
   * 不信任連線註冊表裡 open() 當下快取的身分——登出/session 過期後這裡會擋下來。
   */
  handleSend: (peer: Peer, text: string): SendResult => {
    const user = socketAuth.identify(peer)
    if (!user) return { ok: false, code: 'unauthorized', message: '請先登入才能發言' }

    const trimmed = typeof text === 'string' ? text.trim() : ''
    if (!trimmed) return { ok: false, code: 'empty_text', message: '訊息不能為空' }
    if (trimmed.length > MAX_TEXT_LENGTH) {
      return { ok: false, code: 'text_too_long', message: `訊息不能超過 ${MAX_TEXT_LENGTH} 字` }
    }

    const now = Date.now()
    const last = lastSentAt.get(user.id) ?? 0
    if (now - last < RATE_LIMIT_MS) {
      return { ok: false, code: 'rate_limited', message: '發言太頻繁，請稍後再試' }
    }
    lastSentAt.set(user.id, now)

    const message: ChatMessage = {
      id: `${now}-${Math.random().toString(16).slice(2, 8)}`,
      userId: user.id,
      userName: user.name,
      text: trimmed,
      ts: now
    }
    history.push(message)
    if (history.length > MAX_HISTORY) history.shift()

    return { ok: true, message }
  }
}
