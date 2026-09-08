export type RoleDef = {
  id: string
  name: string
  builtin: boolean
  testMode: boolean
  npcMode: boolean
  dailyCoinReward: {
    enabled: boolean
    amount: number
  }
}

const MAX_NAME_LENGTH = 20
const MAX_DAILY_COIN_AMOUNT = 1_000_000

/** 'npc' 角色的測試模式／NPC模式固定為開啟，不可關閉（見 roleDefsService.updateSettings）。 */
const LOCKED_ON_ROLE_ID = 'npc'

function _defaultSettings(): Pick<RoleDef, 'testMode' | 'npcMode' | 'dailyCoinReward'> {
  return { testMode: false, npcMode: false, dailyCoinReward: { enabled: false, amount: 0 } }
}

const BUILTIN_ROLES: RoleDef[] = [
  { id: 'admin', name: 'Admin', builtin: true, ..._defaultSettings() },
  { id: 'user', name: 'User', builtin: true, ..._defaultSettings() },
  { id: 'npc', name: 'NPC', builtin: true, ..._defaultSettings(), testMode: true, npcMode: true }
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
   * @param id 角色 id
   * @returns 角色定義，不存在則 undefined
   */
  get: (id: string): RoleDef | undefined => roles.get(id),

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

    const role: RoleDef = { id, name, builtin: false, ..._defaultSettings() }
    roles.set(id, role)
    return role
  },

  /**
   * 刪除自訂角色（內建角色不可刪除）
   * @param id 角色 id
   */
  remove: (id: string): void => {
    const role = roles.get(id)
    if (!role) throw createError({ statusCode: 404, message: '找不到該角色。' })
    if (role.builtin) throw createError({ statusCode: 400, message: '內建角色不可刪除。' })
    roles.delete(id)
  },

  /**
   * 更新角色開關設定（測試模式／NPC模式／每日自動加F幣）；內建與自訂角色皆可調整。
   * @param id 角色 id
   * @param patch 欲更新的欄位，未帶到的欄位維持原值
   * @returns 更新後的角色定義
   */
  updateSettings: (id: string, patch: {
    testMode?: boolean
    npcMode?: boolean
    dailyCoinReward?: { enabled?: boolean; amount?: number }
  }): RoleDef => {
    const role = roles.get(id)
    if (!role) throw createError({ statusCode: 404, message: '找不到該角色。' })

    const locked = id === LOCKED_ON_ROLE_ID
    if (locked && patch.testMode === false) {
      throw createError({ statusCode: 400, message: 'NPC 角色的測試模式固定為開啟，不可關閉。' })
    }
    if (locked && patch.npcMode === false) {
      throw createError({ statusCode: 400, message: 'NPC 角色的 NPC模式固定為開啟，不可關閉。' })
    }

    if (patch.testMode !== undefined) role.testMode = patch.testMode
    if (patch.npcMode !== undefined) role.npcMode = patch.npcMode
    if (patch.dailyCoinReward?.enabled !== undefined) {
      role.dailyCoinReward.enabled = patch.dailyCoinReward.enabled
    }
    if (patch.dailyCoinReward?.amount !== undefined) {
      const amount = patch.dailyCoinReward.amount
      if (!Number.isFinite(amount) || amount < 0 || amount > MAX_DAILY_COIN_AMOUNT) {
        throw createError({ statusCode: 400, message: `金額需介於 0～${MAX_DAILY_COIN_AMOUNT}。` })
      }
      role.dailyCoinReward.amount = Math.floor(amount)
    }
    return role
  }
}
