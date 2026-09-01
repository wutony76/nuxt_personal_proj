import { sessionController } from '../../../services/auth'
import { chatScheduleService, type ChatScheduleRepeat } from '../../../services/social/chatSchedule'

type Body = {
  text?: unknown
  hour?: unknown
  minute?: unknown
  /** 也可傳 "07:00" 這種 time 字串，優先於 hour/minute */
  time?: unknown
  repeat?: unknown
}

/**
 * 新增聊天室排程
 * @returns 新建的排程
 */
export default defineEventHandler(async (event) => {
  const user = sessionController.requireAdmin(event)
  const body = await readBody<Body>(event)

  let hour = Number(body?.hour)
  let minute = Number(body?.minute)
  const timeStr = typeof body?.time === 'string' ? body.time.trim() : ''
  if (timeStr) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(timeStr)
    if (!m) throw createError({ statusCode: 400, message: '時間格式須為 HH:mm。' })
    hour = Number(m[1])
    minute = Number(m[2])
  }

  const repeatRaw = String(body?.repeat ?? 'daily')
  const repeat: ChatScheduleRepeat = repeatRaw === 'once' ? 'once' : 'daily'

  const schedule = chatScheduleService.add({
    text: typeof body?.text === 'string' ? body.text : '',
    hour,
    minute,
    repeat,
    createdBy: user.id
  })
  return { schedule }
})
