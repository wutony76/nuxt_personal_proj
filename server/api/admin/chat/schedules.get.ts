import { sessionController } from '../../../services/auth'
import { chatScheduleService } from '../../../services/social/chatSchedule'

/** 列出聊天室排程 */
export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)
  return { schedules: chatScheduleService.list() }
})
