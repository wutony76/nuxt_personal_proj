import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/**
 * 取得 6hc-cd 跨分頁單期總上限設定（全站預設值 + 玩家個別覆寫清單），見
 * openspec/changes/add-6hccd-quota-p2/design.md 第 4 節。
 */
export default defineEventHandler((event) => {
  sessionController.requireAdminView(event)
  return Storage.manager.lotteryBg.sixhccdQuota.getSettings()
})
