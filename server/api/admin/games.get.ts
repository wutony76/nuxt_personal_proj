import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/**
 * 列出兩分類項目（`bg` 15 個盤口 + `retro` 26 款遊戲）的「總閘」開關狀態
 * （見 /admin/roles「遊戲列表」，關閉後不分角色全站都看不到）
 * @returns games
 */
export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)
  return { games: Storage.manager.admin.roleGamePerms.listGlobal() }
})
