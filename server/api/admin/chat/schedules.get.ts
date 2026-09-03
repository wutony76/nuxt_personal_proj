import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/** 列出聊天室排程 */
export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)
  return { schedules: Storage.manager.admin.chatSchedule.list() }
})
