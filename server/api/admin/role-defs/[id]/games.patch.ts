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
 * 切換指定角色的單一遊戲／盤口開關（僅限自訂角色）
 * @returns games（切換後該角色兩分類全部項目的開關狀態）
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)
  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, message: '缺少角色 id。' })

  const body = await readBody<Body>(event)
  const category = String(body?.category ?? '') as GameCategory
  const key = String(body?.key ?? '').trim()
  if (!VALID_CATEGORIES.includes(category) || !key) {
    throw createError({ statusCode: 400, message: '分類或項目參數錯誤。' })
  }
  if (typeof body?.enabled !== 'boolean') {
    throw createError({ statusCode: 400, message: 'enabled 必須是布林值。' })
  }

  Storage.manager.admin.roleGamePerms.toggle(id, category, key, body.enabled)
  return { games: Storage.manager.admin.roleGamePerms.listForRole(id) }
})
