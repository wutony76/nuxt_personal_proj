export type RoleDef = {
  id: string
  name: string
  builtin: boolean
}

const MAX_NAME_LENGTH = 20

const BUILTIN_ROLES: RoleDef[] = [
  { id: 'admin', name: 'Admin', builtin: true },
  { id: 'user', name: 'User', builtin: true },
  { id: 'npc', name: 'NPC', builtin: true }
]

/** 執行期角色清單；啟動時自種子複製，重啟回復。 */
const roles = new Map<string, RoleDef>(BUILTIN_ROLES.map((r) => [r.id, r]))

/**
 * @param name 角色名稱
 * @returns slug 化的 id
 */
function _slug(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || `role-${Date.now().toString(36)}`
}

/**
 * 角色清單查詢／新增。
 * 只有內建的 'admin' id 會授予後台權限（見 adminAccess.ts 的 setRole）；
 * 這裡新增的角色一律 builtin:false，不會取得 admin 權限。
 */
export const roleDefsService = {
  /**
   * @returns 全部角色（依新增順序）
   */
  list: (): RoleDef[] => Array.from(roles.values()),

  /**
   * @param id 角色 id
   * @returns 是否存在
   */
  exists: (id: string): boolean => roles.has(id),

  /**
   * 新增自訂角色
   * @param input.name 角色名稱
   * @returns 新建角色
   */
  create: (input: { name: string }): RoleDef => {
    const name = String(input?.name ?? '').trim()
    if (!name) throw createError({ statusCode: 400, message: '請輸入角色名稱。' })
    if (name.length > MAX_NAME_LENGTH) {
      throw createError({ statusCode: 400, message: `角色名稱不能超過 ${MAX_NAME_LENGTH} 字。` })
    }
    if (Array.from(roles.values()).some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      throw createError({ statusCode: 400, message: '此角色名稱已存在。' })
    }

    let id = _slug(name)
    if (id === 'admin') {
      throw createError({ statusCode: 400, message: '此角色名稱不可使用。' })
    }
    while (roles.has(id)) {
      id = `${id}-${Math.random().toString(36).slice(2, 5)}`
    }

    const role: RoleDef = { id, name, builtin: false }
    roles.set(id, role)
    return role
  }
}
