import { chatService } from './chatService'
import { socketHub } from './socketHub'

export type ChatScheduleRepeat = 'daily' | 'once'

export type ChatSchedule = {
  id: string
  text: string
  /** 0–23 */
  hour: number
  /** 0–59 */
  minute: number
  repeat: ChatScheduleRepeat
  createdBy: string
  createdAt: number
  /** 上次觸發的 YYYYMMDDHHMM，避免同一分鐘重複發 */
  lastFiredKey?: string
}

const MAX_SCHEDULES = 30
const MAX_TEXT_LENGTH = 200

const schedules: ChatSchedule[] = []

function _uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function _pad(n: number): string {
  return String(n).padStart(2, '0')
}

function _fireKey(now: Date): string {
  return `${now.getFullYear()}${_pad(now.getMonth() + 1)}${_pad(now.getDate())}${_pad(now.getHours())}${_pad(now.getMinutes())}`
}

/**
 * 聊天室排程：in-memory，重啟清空。
 * tick() 由 server plugin 的 runCircle 呼叫；到點後以「管理者: 排程」發到全站聊天室。
 */
export const chatScheduleService = {
  list: (): ChatSchedule[] =>
    [...schedules].toSorted((a, b) => a.hour - b.hour || a.minute - b.minute || a.createdAt - b.createdAt),

  /**
   * 新增一筆排程
   * @param input.text 訊息內容
   * @param input.hour 小時 0–23
   * @param input.minute 分鐘 0–59
   * @param input.repeat daily＝每天／once＝只發一次
   * @param input.createdBy 建立者 userId
   * @returns 新建的排程
   */
  add: (input: {
    text: string
    hour: number
    minute: number
    repeat: ChatScheduleRepeat
    createdBy: string
  }): ChatSchedule => {
    const text = String(input.text ?? '').trim()
    if (!text) throw createError({ statusCode: 400, message: '請輸入訊息內容。' })
    if (text.length > MAX_TEXT_LENGTH) {
      throw createError({ statusCode: 400, message: `訊息不能超過 ${MAX_TEXT_LENGTH} 字。` })
    }
    const hour = Number(input.hour)
    const minute = Number(input.minute)
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      throw createError({ statusCode: 400, message: '小時須為 0–23。' })
    }
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
      throw createError({ statusCode: 400, message: '分鐘須為 0–59。' })
    }
    const repeat = input.repeat === 'once' ? 'once' : 'daily'
    if (schedules.length >= MAX_SCHEDULES) {
      throw createError({ statusCode: 400, message: `排程最多 ${MAX_SCHEDULES} 筆。` })
    }

    const row: ChatSchedule = {
      id: _uid(),
      text,
      hour,
      minute,
      repeat,
      createdBy: String(input.createdBy ?? ''),
      createdAt: Date.now()
    }
    schedules.push(row)
    return row
  },

  /**
   * 刪除排程
   * @param id 排程 id
   * @returns 是否刪除成功
   */
  remove: (id: string): boolean => {
    const idx = schedules.findIndex((s) => s.id === id)
    if (idx < 0) return false
    schedules.splice(idx, 1)
    return true
  },

  /**
   * 檢查是否有排程到點；到點則發聊天室訊息。
   * once 發完後移除；daily 以 lastFiredKey 防同一分鐘重發。
   */
  tick: (now = new Date()) => {
    if (schedules.length === 0) return
    const h = now.getHours()
    const m = now.getMinutes()
    const key = _fireKey(now)
    const toRemove: string[] = []

    for (const row of schedules) {
      if (row.hour !== h || row.minute !== m) continue
      if (row.lastFiredKey === key) continue

      row.lastFiredKey = key
      const message = chatService.pushAdminMessage(row.text)
      socketHub.broadcast('chat:message', message)

      if (row.repeat === 'once') toRemove.push(row.id)
    }

    if (toRemove.length > 0) {
      for (const id of toRemove) {
        const idx = schedules.findIndex((s) => s.id === id)
        if (idx >= 0) schedules.splice(idx, 1)
      }
    }
  }
}
