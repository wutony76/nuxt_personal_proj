import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/**
 * 會員自查目前角色被關閉的遊戲／盤口（前台強制生效用，見
 * openspec/changes/add-role-game-perms/design.md Decision 4）
 * @returns disabled（`{category, key}[]`，內建角色回空陣列）
 */
export default defineEventHandler((event) => {
  const login = sessionController.require(event)
  const roleId = Storage.manager.admin.access.roleOf(login.id)
  return { disabled: Storage.manager.admin.roleGamePerms.disabledEntriesOf(roleId) }
})
