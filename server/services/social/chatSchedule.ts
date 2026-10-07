import { chatService } from './chatService'
import { socketHub } from './socketHub'
import { isDbEnabled, getDb } from 'serv/services/db'
import { chatSchedules as chatSchedulesTable } from 'serv/services/db/schema'
import { eq } from 'drizzle-orm'

export type ChatScheduleRepeat = 'daily' | 'once' | 'interval'

export type ChatSchedule = {
  id: string
  text: string
  /** 0–23；interval 模式可為 0（不參與比對） */
  hour: number
  /** 0–59；interval 模式可為 0（不參與比對） */
  minute: number
  repeat: ChatScheduleRepeat
  /** 僅 interval：間隔秒數 */
  intervalSeconds?: number
  /** 是否啟用；新增預設 true */
  enabled: boolean
  createdBy: string
  /** 建立者顯示名，觸發時組成「管理者: {name}」 */
  createdByName: string
  createdAt: number
  /** daily／once：上次觸發的 YYYYMMDDHHMM，避免同一分鐘重複發 */
  lastFiredKey?: string
  /** interval：上次觸發的 epoch ms */
  lastFiredAt?: number
}

const MAX_SCHEDULES = 30
const MAX_TEXT_LENGTH = 200
const MIN_INTERVAL_SECONDS = 5
const MAX_INTERVAL_SECONDS = 86400

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

function _adminDisplayName(row: ChatSchedule): string {
  return `管理者: ${row.createdByName || '管理者'}`
}

function _parseRepeat(raw: unknown): ChatScheduleRepeat {
  if (raw === 'once') return 'once'
  if (raw === 'interval') return 'interval'
  return 'daily'
}

function _toDbRow(row: ChatSchedule) {
  return {
    id: row.id,
    text: row.text,
    hour: row.hour,
    minute: row.minute,
    repeat: row.repeat,
    intervalSeconds: row.intervalSeconds ?? null,
    enabled: row.enabled,
    createdBy: row.createdBy,
    createdByName: row.createdByName,
    createdAt: new Date(row.createdAt)
  }
}

/**
 * DB row → 記憶體物件：運行游標欄位不是持久化內容，一律視為「尚未觸發」（見
 * migrate-chat-schedule-postgres/design.md 第 3 節）。interval 類型的 lastFiredAt 設為回填
 * 當下，等同 setEnabled(true) 重新開啟時的既有語意，避免停機期間累積一次連發。
 */
function _toMemoryRow(row: typeof chatSchedulesTable.$inferSelect): ChatSchedule {
  const repeat = row.repeat as ChatScheduleRepeat
  return {
    id: row.id,
    text: row.text,
    hour: row.hour,
    minute: row.minute,
    repeat,
    intervalSeconds: row.intervalSeconds ?? undefined,
    enabled: row.enabled,
    createdBy: row.createdBy,
    createdByName: row.createdByName,
    createdAt: row.createdAt.getTime(),
    lastFiredAt: repeat === 'interval' ? Date.now() : undefined
  }
}

/**
 * 聊天室排程：in-memory，重啟清空。
 * tick() 由 server plugin 的 runCircle 呼叫；到點後以「管理者: {建立者名稱}」發到全站聊天室。
 */
export const chatScheduleService = {
  list: (): ChatSchedule[] =>
    [...schedules].toSorted((a, b) => b.createdAt - a.createdAt),

  /**
   * 新增一筆排程
   * @param input.text 訊息內容
   * @param input.hour 小時 0–23（interval 可省略，預設 0）
   * @param input.minute 分鐘 0–59（interval 可省略，預設 0）
   * @param input.repeat daily／once／interval
   * @param input.intervalSeconds interval 時必填，秒數 5–86400
   * @param input.createdBy 建立者 userId
   * @param input.createdByName 建立者顯示名
   * @returns 新建的排程
   */
  /** write-through（見 migrate-chat-schedule-postgres/design.md 第 2 節） */
  add: async (input: {
    text: string
    hour?: number
    minute?: number
    repeat: ChatScheduleRepeat
    intervalSeconds?: number
    createdBy: string
    createdByName: string
  }): Promise<ChatSchedule> => {
    const text = String(input.text ?? '').trim()
    if (!text) throw createError({ statusCode: 400, message: '請輸入訊息內容。' })
    if (text.length > MAX_TEXT_LENGTH) {
      throw createError({ statusCode: 400, message: `訊息不能超過 ${MAX_TEXT_LENGTH} 字。` })
    }
    if (schedules.length >= MAX_SCHEDULES) {
      throw createError({ statusCode: 400, message: `排程最多 ${MAX_SCHEDULES} 筆。` })
    }

    const repeat = _parseRepeat(input.repeat)
    const createdAt = Date.now()
    const createdBy = String(input.createdBy ?? '')
    const createdByName = String(input.createdByName ?? '').trim() || '管理者'

    let row: ChatSchedule
    if (repeat === 'interval') {
      const intervalSeconds = Number(input.intervalSeconds)
      if (!Number.isInteger(intervalSeconds) || intervalSeconds < MIN_INTERVAL_SECONDS || intervalSeconds > MAX_INTERVAL_SECONDS) {
        throw createError({
          statusCode: 400,
          message: `間隔秒數須為 ${MIN_INTERVAL_SECONDS}–${MAX_INTERVAL_SECONDS} 的整數。`
        })
      }
      row = {
        id: _uid(),
        text,
        hour: 0,
        minute: 0,
        repeat: 'interval',
        intervalSeconds,
        enabled: true,
        createdBy,
        createdByName,
        createdAt,
        lastFiredAt: createdAt
      }
    } else {
      const hour = Number(input.hour)
      const minute = Number(input.minute)
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
        throw createError({ statusCode: 400, message: '小時須為 0–23。' })
      }
      if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
        throw createError({ statusCode: 400, message: '分鐘須為 0–59。' })
      }
      row = {
        id: _uid(),
        text,
        hour,
        minute,
        repeat,
        enabled: true,
        createdBy,
        createdByName,
        createdAt
      }
    }

    if (isDbEnabled()) {
      await getDb().insert(chatSchedulesTable).values(_toDbRow(row))
    }

    schedules.push(row)
    return row
  },

  /**
   * 刪除排程（write-through，見 migrate-chat-schedule-postgres/design.md 第 2 節）
   * @param id 排程 id
   * @returns 是否刪除成功
   */
  remove: async (id: string): Promise<boolean> => {
    const idx = schedules.findIndex((s) => s.id === id)
    if (idx < 0) return false

    if (isDbEnabled()) {
      await getDb().delete(chatSchedulesTable).where(eq(chatSchedulesTable.id, id))
    }

    schedules.splice(idx, 1)
    return true
  },

  /**
   * 開關排程（write-through，見 migrate-chat-schedule-postgres/design.md 第 2 節；運行游標
   * 欄位的重置邏輯純記憶體操作，不寫 DB）
   * @param id 排程 id
   * @param enabled 是否啟用
   * @returns 更新後的排程；找不到則 null
   */
  setEnabled: async (id: string, enabled: boolean): Promise<ChatSchedule | null> => {
    const row = schedules.find((s) => s.id === id)
    if (!row) return null

    if (isDbEnabled()) {
      await getDb().update(chatSchedulesTable).set({ enabled: Boolean(enabled) })
        .where(eq(chatSchedulesTable.id, id))
    }

    row.enabled = Boolean(enabled)
    // 重新開啟時重置計時，避免關閉期間累積後一次連發／立刻觸發
    if (row.enabled) {
      if (row.repeat === 'interval') row.lastFiredAt = Date.now()
      else delete row.lastFiredKey
    }
    return row
  },

  /**
   * 檢查是否有排程到點；到點則發聊天室訊息。
   * once 發完後移除；daily 以 lastFiredKey 防同一分鐘重發；
   * interval 以 lastFiredAt + intervalSeconds 判斷。
   * enabled === false 的排程略過。
   */
  tick: (now = new Date()) => {
    if (schedules.length === 0) return
    const h = now.getHours()
    const m = now.getMinutes()
    const key = _fireKey(now)
    const nowMs = now.getTime()
    const toRemove: string[] = []

    for (const row of schedules) {
      if (!row.enabled) continue

      if (row.repeat === 'interval') {
        const sec = row.intervalSeconds ?? 0
        if (sec <= 0) continue
        const last = row.lastFiredAt ?? row.createdAt
        if (nowMs - last < sec * 1000) continue

        row.lastFiredAt = nowMs
        const message = chatService.pushAdminMessage(row.text, _adminDisplayName(row))
        socketHub.broadcast('chat:message', message)
        continue
      }

      if (row.hour !== h || row.minute !== m) continue
      if (row.lastFiredKey === key) continue

      row.lastFiredKey = key
      const message = chatService.pushAdminMessage(row.text, _adminDisplayName(row))
      socketHub.broadcast('chat:message', message)

      if (row.repeat === 'once') toRemove.push(row.id)
    }

    if (toRemove.length > 0) {
      for (const id of toRemove) {
        const idx = schedules.findIndex((s) => s.id === id)
        if (idx >= 0) schedules.splice(idx, 1)
      }
    }
  },

  /**
   * 開機回填（見 migrate-chat-schedule-postgres/design.md 第 3 節）：DB 未啟用時直接 return，
   * 呼叫端（hfyyManage.ts）自己跑原本的無條件種子迴圈，維持純記憶體模式下的既有行為。DB 啟用時
   * 是空的（全新環境）才寫入預設的 4 筆測試排程；已有資料就用 DB 內容整個覆蓋記憶體，避免無限
   * 疊加種子排程撞到 MAX_SCHEDULES 上限。
   * @param defaultAdminId 種子排程的 createdBy
   * @param defaultAdminName 種子排程的 createdByName
   */
  rehydrateOrSeed: async (defaultAdminId: string, defaultAdminName: string): Promise<void> => {
    if (!isDbEnabled()) return
    const db = getDb()
    const existing = await db.select().from(chatSchedulesTable)

    if (existing.length === 0) {
      const createdAt = Date.now()
      const seedRows: ChatSchedule[] = [30, 20, 10, 5].map((seconds) => ({
        id: _uid(),
        text: `${seconds}s 發送測試訊息`,
        hour: 0,
        minute: 0,
        repeat: 'interval',
        intervalSeconds: seconds,
        enabled: true,
        createdBy: defaultAdminId,
        createdByName: defaultAdminName,
        createdAt,
        lastFiredAt: createdAt
      }))
      await db.insert(chatSchedulesTable).values(seedRows.map(_toDbRow))
      schedules.push(...seedRows)
    } else {
      schedules.length = 0
      schedules.push(...existing.map(_toMemoryRow))
    }
  }
}
