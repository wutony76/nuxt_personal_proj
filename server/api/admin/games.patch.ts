import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'
import type { GameCategory } from 'serv/services/admin/modules/roleGamePerms'

type Body = {
  category?: unknown
  key?: unknown
  enabled?: unknown
}

const VALID_CATEGORIES: GameCategory[] = ['bg', 'retro']

/**
 * 切換單一遊戲／盤口的「總閘」開關（見 /admin/roles「遊戲列表」）：
 * 關閉後不分角色（含內建角色）全站都看不到／用不到。
 * @returns games（切換後兩分類全部項目的總閘開關狀態）
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)

  const body = await readBody<Body>(event)
  const category = String(body?.category ?? '') as GameCategory
  const key = String(body?.key ?? '').trim()
  if (!VALID_CATEGORIES.includes(category) || !key) {
    throw createError({ statusCode: 400, message: '分類或項目參數錯誤。' })
  }
  if (typeof body?.enabled !== 'boolean') {
    throw createError({ statusCode: 400, message: 'enabled 必須是布林值。' })
  }

  Storage.manager.admin.roleGamePerms.toggleGlobal(category, key, body.enabled)
  return { games: Storage.manager.admin.roleGamePerms.listGlobal() }
})
