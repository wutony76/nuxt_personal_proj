import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/**
 * 後台：自動新增一位 NPC 會員——從單字庫隨機組合出不重複的名稱與對應 email，
 * 直接建立角色為 NPC 的新會員，不需要手動輸入
 * @returns 新建帳號（不含密碼）
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const user = await Storage.manager.admin.npcAutoPlay.autoCreateMember()
  return { user }
})
