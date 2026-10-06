import { isDbEnabled, getDb } from 'serv/services/db'
import { roleDefs as roleDefsTable } from 'serv/services/db/schema'
import { eq } from 'drizzle-orm'

export type RoleDef = {
  id: string
  name: string
  builtin: boolean
  testMode: boolean
  npcMode: boolean
  /** 唯讀模式：開啟後，指派此角色的帳號不需要在 adminIds 白名單內也能瀏覽整個後台，
   *  但所有寫入端點仍走 requireAdmin（白名單限定），一律被拒絕。見 adminAccess.ts accessLevel。 */
  demoMode: boolean
  dailyCoinReward: {
    enabled: boolean
    amount: number
  }
}

const MAX_NAME_LENGTH = 20
const MAX_DAILY_COIN_AMOUNT = 1_000_000

/** 'npc' 角色的測試模式／NPC模式固定為開啟，不可關閉（見 roleDefsService.updateSettings）。 */
const LOCKED_ON_ROLE_ID = 'npc'
/** 'demo' 角色的唯讀模式固定為開啟，不可關閉（見 roleDefsService.updateSettings）。 */
const LOCKED_DEMO_ROLE_ID = 'demo'

function _defaultSettings(): Pick<RoleDef, 'testMode' | 'npcMode' | 'demoMode' | 'dailyCoinReward'> {
  return { testMode: false, npcMode: false, demoMode: false, dailyCoinReward: { enabled: false, amount: 0 } }
}

const BUILTIN_ROLES: RoleDef[] = [
  { id: 'admin', name: 'Admin', builtin: true, ..._defaultSettings() },
  { id: 'user', name: 'User', builtin: true, ..._defaultSettings() },
  { id: 'npc', name: 'NPC', builtin: true, ..._defaultSettings(), testMode: true, npcMode: true },
  { id: 'demo', name: 'Demo', builtin: true, ..._defaultSettings(), demoMode: true }
]

/** 執行期角色清單；啟動時自種子複製，重啟回復（DB 啟用時會在開機回填階段被覆蓋，見 rehydrateOrSeed）。 */
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

function _toDbRow(role: RoleDef) {
  return {
    id: role.id,
    name: role.name,
    builtin: role.builtin,
    testMode: role.testMode,
    npcMode: role.npcMode,
    demoMode: role.demoMode,
    dailyCoinRewardEnabled: role.dailyCoinReward.enabled,
    dailyCoinRewardAmount: role.dailyCoinReward.amount
  }
}

function _fromDbRow(row: typeof roleDefsTable.$inferSelect): RoleDef {
  return {
    id: row.id,
    name: row.name,
    builtin: row.builtin,
    testMode: row.testMode,
    npcMode: row.npcMode,
    demoMode: row.demoMode,
    dailyCoinReward: { enabled: row.dailyCoinRewardEnabled, amount: row.dailyCoinRewardAmount }
  }
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
   * 新增自訂角色（write-through：DB 啟用時先寫 DB 成功才更新記憶體，見
   * migrate-members-roledefs-postgres/design.md 第 4 節）
   * @param input.name 角色名稱
   * @returns 新建角色
   */
  create: async (input: { name: string }): Promise<RoleDef> => {
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

    if (isDbEnabled()) {
      await getDb().insert(roleDefsTable).values(_toDbRow(role))
    }

    roles.set(id, role)
    return role
  },

  /**
   * 刪除自訂角色（內建角色不可刪除）。DB 啟用時，`members.role_id` 的 `ON DELETE SET DEFAULT`
   * 會自動把指向此角色的會員退回 'user'；呼叫端仍需呼叫 `adminAccessService.clearRoleAssignments()`
   * 讓記憶體裡的 `memberRoleId` Map 跟 DB 的結果保持一致（見 design.md 刪除角色的交易邊界）。
   * @param id 角色 id
   */
  remove: async (id: string): Promise<void> => {
    const role = roles.get(id)
    if (!role) throw createError({ statusCode: 404, message: '找不到該角色。' })
    if (role.builtin) throw createError({ statusCode: 400, message: '內建角色不可刪除。' })

    if (isDbEnabled()) {
      await getDb().delete(roleDefsTable).where(eq(roleDefsTable.id, id))
    }

    roles.delete(id)
  },

  /**
   * 更新角色開關設定（測試模式／NPC模式／每日自動加F幣）；內建與自訂角色皆可調整。
   * @param id 角色 id
   * @param patch 欲更新的欄位，未帶到的欄位維持原值
   * @returns 更新後的角色定義
   */
  updateSettings: async (id: string, patch: {
    testMode?: boolean
    npcMode?: boolean
    demoMode?: boolean
    dailyCoinReward?: { enabled?: boolean; amount?: number }
  }): Promise<RoleDef> => {
    const role = roles.get(id)
    if (!role) throw createError({ statusCode: 404, message: '找不到該角色。' })

    const locked = id === LOCKED_ON_ROLE_ID
    if (locked && patch.testMode === false) {
      throw createError({ statusCode: 400, message: 'NPC 角色的測試模式固定為開啟，不可關閉。' })
    }
    if (locked && patch.npcMode === false) {
      throw createError({ statusCode: 400, message: 'NPC 角色的 NPC模式固定為開啟，不可關閉。' })
    }
    if (id === LOCKED_DEMO_ROLE_ID && patch.demoMode === false) {
      throw createError({ statusCode: 400, message: 'Demo 角色的唯讀模式固定為開啟，不可關閉。' })
    }

    // 先算出合併後的完整值（不 mutate 原物件），DB 寫入成功後才套用到記憶體
    const next: RoleDef = {
      ...role,
      testMode: patch.testMode ?? role.testMode,
      npcMode: patch.npcMode ?? role.npcMode,
      demoMode: patch.demoMode ?? role.demoMode,
      dailyCoinReward: { ...role.dailyCoinReward }
    }
    if (patch.dailyCoinReward?.enabled !== undefined) {
      next.dailyCoinReward.enabled = patch.dailyCoinReward.enabled
    }
    if (patch.dailyCoinReward?.amount !== undefined) {
      const amount = patch.dailyCoinReward.amount
      if (!Number.isFinite(amount) || amount < 0 || amount > MAX_DAILY_COIN_AMOUNT) {
        throw createError({ statusCode: 400, message: `金額需介於 0～${MAX_DAILY_COIN_AMOUNT}。` })
      }
      next.dailyCoinReward.amount = Math.floor(amount)
    }

    if (isDbEnabled()) {
      await getDb().update(roleDefsTable).set({ ..._toDbRow(next), updatedAt: new Date() })
        .where(eq(roleDefsTable.id, id))
    }

    role.testMode = next.testMode
    role.npcMode = next.npcMode
    role.demoMode = next.demoMode
    role.dailyCoinReward = next.dailyCoinReward
    return role
  },

  /**
   * 開機回填（見 migrate-members-roledefs-postgres/design.md 第 5 節）：DB 未啟用時整段略過
   * （維持模組載入時就種好的 BUILTIN_ROLES）；DB 為空（全新環境）時把目前記憶體內容寫回 DB；
   * DB 已有資料時用 DB 內容覆蓋掉記憶體（不執行任何種子邏輯）。
   */
  rehydrateOrSeed: async (): Promise<void> => {
    if (!isDbEnabled()) return
    const db = getDb()
    const existing = await db.select().from(roleDefsTable)
    if (existing.length === 0) {
      await db.insert(roleDefsTable).values(Array.from(roles.values()).map(_toDbRow))
    } else {
      roles.clear()
      for (const row of existing) roles.set(row.id, _fromDbRow(row))
    }
  }
}
