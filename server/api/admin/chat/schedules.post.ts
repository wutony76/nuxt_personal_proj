import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'
import type { ChatScheduleRepeat } from 'serv/services/social/chatSchedule'

type Body = {
  text?: unknown
  hour?: unknown
  minute?: unknown
  /** 也可傳 "07:00" 這種 time 字串，優先於 hour/minute */
  time?: unknown
  repeat?: unknown
  /** interval 模式：間隔秒數 */
  intervalSeconds?: unknown
}

/**
 * 新增聊天室排程
 * @returns 新建的排程
 */
export default defineEventHandler(async (event) => {
  const user = sessionController.requireAdmin(event)
  const body = await readBody<Body>(event)

  const repeatRaw = String(body?.repeat ?? 'daily')
  const repeat: ChatScheduleRepeat =
    repeatRaw === 'once' ? 'once' : repeatRaw === 'interval' ? 'interval' : 'daily'

  if (repeat === 'interval') {
    const schedule = Storage.manager.admin.chatSchedule.add({
      text: typeof body?.text === 'string' ? body.text : '',
      repeat: 'interval',
      intervalSeconds: Number(body?.intervalSeconds),
      createdBy: user.id,
      createdByName: user.name
    })
    return { schedule }
  }

  let hour = Number(body?.hour)
  let minute = Number(body?.minute)
  const timeStr = typeof body?.time === 'string' ? body.time.trim() : ''
  if (timeStr) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(timeStr)
    if (!m) throw createError({ statusCode: 400, message: '時間格式須為 HH:mm。' })
    hour = Number(m[1])
    minute = Number(m[2])
  }

  const schedule = Storage.manager.admin.chatSchedule.add({
    text: typeof body?.text === 'string' ? body.text : '',
    hour,
    minute,
    repeat,
    createdBy: user.id,
    createdByName: user.name
  })
  return { schedule }
})
