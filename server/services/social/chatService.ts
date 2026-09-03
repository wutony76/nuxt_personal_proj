import type { Peer } from 'crossws'
import { socketAuth } from '../../utils/socketAuth'
import { adminAccessService } from 'serv/services/admin/modules/adminAccess'

export type ChatMessage = {
  id: string
  userId: string
  userName: string
  text: string
  ts: number
  /** 後台總覽以管理者身分送出時為 true，顯示名為「管理者: XXX」 */
  asAdmin?: boolean
}

type SendOptions = {
  /** 僅後台總覽聊天室會帶 true；server 會再驗動態白名單，不信前端宣稱 */
  asAdmin?: boolean
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

function _pushMessage(message: ChatMessage): ChatMessage {
  history.push(message)
  if (history.length > MAX_HISTORY) history.shift()
  return message
}

/**
 * 聊天訊息驗證與記憶體歷史（ring buffer，上限 50 筆）。
 * 刻意不 import socketHub——避免循環依賴，handleSend() 只回傳結果，
 * 由呼叫端（socketHub.onMessage）決定要不要廣播，維持單向依賴。
 */
export const chatService = {
  recent: (): ChatMessage[] => [...history],

  /**
   * 排程／系統代管理者發言（不經 WebSocket peer、不走 rate limit）。
   * @param text 訊息內容
   * @param userName 顯示名，例如「管理者: XXX」
   * @returns 寫入歷史後的訊息
   */
  pushAdminMessage: (text: string, userName: string): ChatMessage => {
    const trimmed = text.trim()
    const now = Date.now()
    return _pushMessage({
      id: `${now}-${Math.random().toString(16).slice(2, 8)}`,
      userId: 'SYSTEM_SCHEDULE',
      userName,
      text: trimmed.slice(0, MAX_TEXT_LENGTH),
      ts: now,
      asAdmin: true
    })
  },

  /**
   * 每次送出都重新查驗身分（見 add-socket-social design.md 對策③），
   * 不信任連線註冊表裡 open() 當下快取的身分——登出/session 過期後這裡會擋下來。
   * @param peer WebSocket peer
   * @param text 訊息內容
   * @param options.asAdmin 後台管理者發言：顯示名改為「管理者: {name}」
   * @returns 成功帶 message，失敗帶 code／message
   */
  handleSend: (peer: Peer, text: string, options: SendOptions = {}): SendResult => {
    const user = socketAuth.identify(peer)
    if (!user) return { ok: false, code: 'unauthorized', message: '請先登入才能發言' }

    const wantAdmin = Boolean(options.asAdmin)
    if (wantAdmin && !adminAccessService.isAdmin(user.id)) {
      return { ok: false, code: 'forbidden', message: '無管理員權限，無法以管理者身分發言' }
    }

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

    return {
      ok: true,
      message: _pushMessage({
        id: `${now}-${Math.random().toString(16).slice(2, 8)}`,
        userId: user.id,
        userName: wantAdmin ? `管理者: ${user.name}` : user.name,
        text: trimmed,
        ts: now,
        asAdmin: wantAdmin || undefined
      })
    }
  }
}
