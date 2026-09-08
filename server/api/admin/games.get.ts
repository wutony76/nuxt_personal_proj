import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/**
 * 列出「角色 x 遊戲權限」可控管的兩分類項目（`bg` 15 個盤口 + `retro` 26 款遊戲）
 * @returns games
 */
export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)
  return { games: Storage.manager.admin.roleGamePerms.catalog() }
})
