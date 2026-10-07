import { ADMIN_USER_IDS } from 'serv/config/admin'
import { Storage } from 'serv/services/storage'
import { encodePasswordBcjs, encodePassword } from 'serv/utils/encrypt'
import UsersClass from 'serv/services/users'
import type { AuthRecord } from 'serv/types/storage'
import { walletBalanceService } from 'serv/services/walletBalance'
import { isDbEnabled, getDb } from 'serv/services/db'
import { members as membersTable } from 'serv/services/db/schema'
import { eq } from 'drizzle-orm'
import { roleDefsService } from './roleDefs'

/** 角色 id，如 'admin'／'user'／'npc' 或自訂角色 id（見 roleDefs.ts）。 */
export type UserRole = string

const DEFAULT_ROLE: UserRole = 'user'

export type AdminAccessUser = {
  id: string
  name: string
  email: string
  role: UserRole
  /** F幣餘額（Storage.users[userId].coin） */
  coin: number
}

/** 執行期白名單；啟動時自程式碼常數複製，重啟回復（DB 啟用時會在開機回填階段被覆蓋，見 rehydrateFromDb）。 */
const adminIds = new Set<string>(ADMIN_USER_IDS)

/** 非 admin 會員目前的角色 id（'user'／'npc'／自訂角色）；未記錄視為預設 DEFAULT_ROLE。 */
const memberRoleId = new Map<string, string>()

const MAX_NAME_LENGTH = 40
const MIN_PASSWORD_LENGTH = 6
const MAX_PASSWORD_LENGTH = 72
const MAX_COIN_ADD = 100_000_000
/** Postgres unique_violation 的 SQLSTATE（見 setEmail/createMember 的 catch） */
const PG_UNIQUE_VIOLATION = '23505'

function _uid(): string {
  return `U0xA${Date.now().toString(16).slice(-6)}${Math.random().toString(16).slice(2, 6)}`.toUpperCase()
}

/**
 * @param email 原始 email
 * @returns 正規化後 email
 */
function _normalizeEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase()
}

/**
 * @param email 待驗證 email
 */
function _validateEmail(email: string): void {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, message: '請輸入有效的 Email。' })
  }
}

/**
 * @param email 目標 email
 * @param exceptUserId 排除的帳號 id（更新自己時）
 */
function _assertEmailAvailable(email: string, exceptUserId?: string): void {
  const accounts = Storage.get.account()
  if (Object.values(accounts).some((row) => row.id !== exceptUserId && row.email === email)) {
    throw createError({ statusCode: 400, message: '此 Email 已被使用。' })
  }
}

/** DB unique constraint 觸發時（race condition 下的最後一道防線），轉成跟 _assertEmailAvailable 一致的錯誤訊息。 */
function _rethrowAsEmailTaken(error: unknown): never {
  if (error && typeof error === 'object' && 'code' in error && error.code === PG_UNIQUE_VIOLATION) {
    throw createError({ statusCode: 400, message: '此 Email 已被使用。' })
  }
  throw error
}

/**
 * @param userId 帳號 id
 * @param email 新 email
 */
function _syncSessionEmail(userId: string, email: string): void {
  for (const session of Storage.get.sessions().values()) {
    if (session.user.id === userId) session.user.email = email
  }
}

/**
 * @param userId 帳號 id
 * @returns F幣餘額
 */
function _userCoin(userId: string): number {
  const row = Storage.get.user(userId) as { coin?: number }
  return Number(row?.coin ?? 0)
}

/**
 * @param row 帳號列
 * @returns 後台列表用使用者摘要
 */
function _toAdminUser(row: AuthRecord): AdminAccessUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: adminAccessService.roleOf(row.id),
    coin: _userCoin(row.id)
  }
}

/**
 * 管理員白名單查詢／異動／新增會員。
 * 所有 isAdmin 判斷應走這裡，不要再直接讀 ADMIN_USER_IDS 陣列。
 */
export const adminAccessService = {
  /**
   * @param userId 帳號 id
   * @returns 是否為管理員
   */
  isAdmin: (userId: string): boolean => adminIds.has(userId),

  /**
   * @param userId 帳號 id
   * @returns 目前角色 id（'admin' 或 memberRoleId 記錄的角色，未記錄則為預設 DEFAULT_ROLE）
   */
  roleOf: (userId: string): UserRole =>
    adminIds.has(userId) ? 'admin' : (memberRoleId.get(userId) ?? DEFAULT_ROLE),

  /**
   * 後台存取層級：白名單帳號一律 'admin'；非白名單帳號若被指派了 demoMode 角色
   * （見 roleDefs.ts），可唯讀瀏覽整個後台但打不了任何寫入端點，回 'demo'；
   * 其餘回 'none'（沒有後台存取權）。
   * @param userId 帳號 id
   * @returns 'admin' | 'demo' | 'none'
   */
  accessLevel: (userId: string): 'admin' | 'demo' | 'none' => {
    if (adminIds.has(userId)) return 'admin'
    const roleId = memberRoleId.get(userId) ?? DEFAULT_ROLE
    return roleDefsService.get(roleId)?.demoMode ? 'demo' : 'none'
  },

  /**
   * 刪除角色時呼叫：目前指派該角色的會員一律退回預設角色（'user'）。DB 啟用時，
   * DB 層已經透過 `members.role_id` 的 `ON DELETE SET DEFAULT` 自動完成同樣的事，
   * 這裡只是讓記憶體的 `memberRoleId` Map 跟 DB 結果保持一致（純記憶體操作，無 DB 寫入）。
   * @param roleId 被刪除的角色 id
   */
  clearRoleAssignments: (roleId: UserRole): void => {
    for (const [userId, role] of memberRoleId.entries()) {
      if (role === roleId) memberRoleId.delete(userId)
    }
  },

  /**
   * 列出全部帳號與角色（名稱排序）
   * @returns 帳號列表
   */
  listUsers: (): AdminAccessUser[] => {
    const accounts = Storage.get.account()
    return Object.values(accounts)
      .map((row) => _toAdminUser(row))
      .toSorted((a, b) => {
        if (a.role !== b.role) return a.role === 'admin' ? -1 : 1
        return a.name.localeCompare(b.name, 'zh-Hant')
      })
  },

  /**
   * 設定帳號角色（write-through：DB 啟用時先寫 DB 成功才更新記憶體）
   * @param userId 目標帳號
   * @param role 角色 id（見 roleDefs.ts）
   * @param actorId 操作者（不可自我降權）
   * @returns 更新後的帳號列
   */
  setRole: async (userId: string, role: UserRole, actorId: string): Promise<AdminAccessUser> => {
    const accounts = Storage.get.account()
    const row = accounts[userId]
    if (!row) throw createError({ statusCode: 404, message: '找不到該帳號。' })
    if (!roleDefsService.exists(role)) {
      throw createError({ statusCode: 400, message: '角色不存在。' })
    }

    const next: UserRole = role
    const currentlyAdmin = adminIds.has(userId)
    const leavingAdmin = next !== 'admin'

    if (leavingAdmin) {
      if (userId === actorId) {
        throw createError({ statusCode: 400, message: '不可將自己降級，以免失去後台權限。' })
      }
      if (currentlyAdmin && adminIds.size <= 1) {
        throw createError({ statusCode: 400, message: '至少需保留一位 Admin。' })
      }
    }

    // is_admin 與 role_id 正交，見 design.md 第 3 節；升為 admin 時 role_id 退回預設 'user'
    // （對應記憶體 memberRoleId.delete() 的語意：admin 身份不查 role_id）
    const newIsAdmin = !leavingAdmin
    const newRoleId = leavingAdmin ? next : 'user'

    if (isDbEnabled()) {
      await getDb().update(membersTable)
        .set({ isAdmin: newIsAdmin, roleId: newRoleId, updatedAt: new Date() })
        .where(eq(membersTable.id, userId))
    }

    if (!leavingAdmin) {
      adminIds.add(userId)
      memberRoleId.delete(userId)
    } else {
      adminIds.delete(userId)
      memberRoleId.set(userId, next)
    }

    return _toAdminUser(row)
  },

  /**
   * 重設會員登入密碼（write-through）
   * @param userId 目標帳號
   * @param password 新明文密碼
   * @returns 更新後的帳號列（不回傳密碼）
   */
  setPassword: async (userId: string, password: string): Promise<AdminAccessUser> => {
    const accounts = Storage.get.account()
    const row = accounts[userId]
    if (!row) throw createError({ statusCode: 404, message: '找不到該帳號。' })

    const next = String(password ?? '')
    if (next.length < MIN_PASSWORD_LENGTH || next.length > MAX_PASSWORD_LENGTH) {
      throw createError({
        statusCode: 400,
        message: `密碼長度須為 ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} 字元。`
      })
    }
    const passwordHash = encodePasswordBcjs(next)

    if (isDbEnabled()) {
      await getDb().update(membersTable)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(membersTable.id, userId))
    }

    row.passwordHash = passwordHash
    return _toAdminUser(row)
  },

  /**
   * 更新會員登入 Email（write-through）
   * @param userId 目標帳號
   * @param email 新 email
   * @returns 更新後的帳號列
   */
  setEmail: async (userId: string, email: string): Promise<AdminAccessUser> => {
    const accounts = Storage.get.account()
    const row = accounts[userId]
    if (!row) throw createError({ statusCode: 404, message: '找不到該帳號。' })

    const next = _normalizeEmail(email)
    _validateEmail(next)
    if (next !== row.email) {
      _assertEmailAvailable(next, userId)

      if (isDbEnabled()) {
        try {
          await getDb().update(membersTable)
            .set({ email: next, updatedAt: new Date() })
            .where(eq(membersTable.id, userId))
        } catch (error) {
          _rethrowAsEmailTaken(error)
        }
      }

      row.email = next
      _syncSessionEmail(userId, next)
    }
    return _toAdminUser(row)
  },

  /**
   * 調整會員 F幣（正數充值、負數扣款）——不在本次 Postgres 遷移範圍（見 proposal.md），
   * 維持純記憶體，不寫 DB。
   * @param userId 目標帳號
   * @param delta 變動量（非 0 整數）
   * @returns 更新後的帳號列
   */
  adjustCoin: (userId: string, delta: number): AdminAccessUser => {
    const accounts = Storage.get.account()
    const row = accounts[userId]
    if (!row) throw createError({ statusCode: 404, message: '找不到該帳號。' })

    const amount = Math.trunc(Number(delta))
    if (!Number.isFinite(amount) || amount === 0) {
      throw createError({ statusCode: 400, message: '請輸入非 0 的整數金額（正數充值、負數扣款）。' })
    }
    const abs = Math.abs(amount)
    if (abs > MAX_COIN_ADD) {
      throw createError({
        statusCode: 400,
        message: `單次調整不可超過 ${MAX_COIN_ADD.toLocaleString('zh-TW')}。`
      })
    }

    const isTopup = amount > 0
    walletBalanceService.appendChange(userId, {
      type: isTopup ? 'admin-topup' : 'admin-deduct',
      amount,
      note: isTopup
        ? `後台充值 +${abs.toLocaleString('zh-TW')}`
        : `後台扣款 -${abs.toLocaleString('zh-TW')}`
    })
    return _toAdminUser(row)
  },

  /**
   * 新增會員帳號（write-through）
   * @param input.name 顯示名
   * @param input.email 登入 email（全站唯一，含 @admin 網域）
   * @param input.password 明文密碼
   * @param input.role 預設 user
   * @returns 新建帳號（不含密碼）
   */
  createMember: async (input: {
    name: string
    email: string
    password: string
    role?: UserRole
  }): Promise<AdminAccessUser> => {
    const name = String(input.name ?? '').trim()
    const email = _normalizeEmail(input.email)
    const password = String(input.password ?? '')
    const roleInput = String(input.role ?? DEFAULT_ROLE)
    const role: UserRole = roleDefsService.exists(roleInput) ? roleInput : DEFAULT_ROLE

    if (!name) throw createError({ statusCode: 400, message: '請輸入名稱。' })
    if (name.length > MAX_NAME_LENGTH) {
      throw createError({ statusCode: 400, message: `名稱不能超過 ${MAX_NAME_LENGTH} 字。` })
    }
    _validateEmail(email)
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      throw createError({
        statusCode: 400,
        message: `密碼長度須為 ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} 字元。`
      })
    }

    Storage.get.account()
    const accounts = Storage.account as Record<string, AuthRecord>
    _assertEmailAvailable(email)

    let id = _uid()
    while (accounts[id]) id = _uid()

    const passwordHash = encodePasswordBcjs(password)
    const isAdminRole = role === 'admin'

    if (isDbEnabled()) {
      try {
        await getDb().insert(membersTable).values({
          id,
          name,
          email,
          passwordHash,
          roleId: isAdminRole ? 'user' : role,
          isAdmin: isAdminRole
        })
      } catch (error) {
        _rethrowAsEmailTaken(error)
      }
    }

    accounts[id] = { id, name, email, passwordHash }
    // 初始化遊戲／餘額等使用者狀態
    new UsersClass(id)

    if (isAdminRole) {
      adminIds.add(id)
    } else if (role !== DEFAULT_ROLE) {
      memberRoleId.set(id, role)
    }

    return _toAdminUser(accounts[id]!)
  },

  /**
   * 開機回填用：DB 是否已有 members 資料（見 hfyyManage.ts setStartData()）。
   * @returns DB 啟用且已有資料時為 true
   */
  hasExistingDbMembers: async (): Promise<boolean> => {
    if (!isDbEnabled()) return false
    const rows = await getDb().select({ id: membersTable.id }).from(membersTable).limit(1)
    return rows.length > 0
  },

  /**
   * 開機回填：把 `Storage.init()` 已經直接建立的種子 admin 帳號（不經過 createMember()，
   * 所以不會自動 write-through）補寫進 DB。只應該在確認 DB 是空的（全新環境）時呼叫一次。
   * @param ids 要補寫的帳號 id 清單（呼叫端明確指定，不是「目前記憶體裡的全部帳號」——
   *   setStartData() 跑到這裡時，test/npc 帳號早就透過 createMember() 的 write-through
   *   各自寫進 DB 了，若在這裡又讀整個 Storage.account 重新 INSERT 一次會撞 primary key）
   */
  seedBootAdminsToDb: async (ids: string[]): Promise<void> => {
    if (!isDbEnabled()) return
    const accounts = Storage.get.account()
    const rows = ids
      .map((id) => accounts[id])
      .filter((row): row is AuthRecord => Boolean(row))
      .map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        passwordHash: row.passwordHash,
        roleId: memberRoleId.get(row.id) ?? 'user',
        isAdmin: adminIds.has(row.id)
      }))
    if (rows.length === 0) return
    await getDb().insert(membersTable).values(rows)
  },

  /**
   * 開機回填用：DB 裡是否已經存在至少一筆 admin（`is_admin = true`）。跟 `hasExistingDbMembers()`
   * 是兩個不同判斷——DB 可能已經有一般會員、但剛好沒有任何 admin（見
   * harden-postgres-for-production/design.md 第 4 節的情境矩陣）。
   * @returns DB 啟用且已有 admin 時為 true
   */
  hasExistingAdmin: async (): Promise<boolean> => {
    if (!isDbEnabled()) return false
    const rows = await getDb().select({ id: membersTable.id })
      .from(membersTable).where(eq(membersTable.isAdmin, true)).limit(1)
    return rows.length > 0
  },

  /**
   * 開機回填用：只在 `hasExistingAdmin()` 為 false 時才應該被呼叫，確保重啟後一定有至少一筆可登入
   * 的 admin。跟 `seedBootAdminsToDb()`（全新 DB 情境，直接搬運記憶體裡已經存在的種子帳號）不同，
   * 這裡不假設記憶體裡有任何特定 id 可用——`hasExistingDbMembers()` 為 true 的分支會先整個重建
   * `Storage.account`（見 `rehydrateFromDb()`），原本寫死的 `U0xA000001` 不一定還在記憶體裡，
   * 所以改成直接用 `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` 現場組一筆，用 id upsert（`ON
   * CONFLICT` 補 `is_admin = true`），不依賴記憶體現況。
   */
  seedMissingAdmin: async (): Promise<void> => {
    if (!isDbEnabled()) return
    const id = 'U0xA000001'
    const name = 'Admin'
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com'
    const password = process.env.SEED_ADMIN_PASSWORD || '123456'
    const passwordHash = encodePasswordBcjs(encodePassword(password, email))

    await getDb().insert(membersTable)
      .values({ id, name, email, passwordHash, roleId: 'user', isAdmin: true })
      .onConflictDoUpdate({
        target: membersTable.id,
        set: { isAdmin: true, updatedAt: new Date() }
      })

    const accounts = Storage.account as Record<string, AuthRecord>
    if (!accounts[id]) {
      accounts[id] = { id, name, email, passwordHash }
      new UsersClass(id)
    }
    adminIds.add(id)
    memberRoleId.delete(id)
  },

  /**
   * 開機回填：DB 已有 members 資料時，用 DB 內容完整重建記憶體（取代 Storage.init() 與
   * setStartData() 種子邏輯建立的內容），見 migrate-members-roledefs-postgres/design.md 第 5 節。
   */
  rehydrateFromDb: async (): Promise<void> => {
    if (!isDbEnabled()) return
    const rows = await getDb().select().from(membersTable)

    const accounts = Storage.account as Record<string, AuthRecord>
    for (const key of Object.keys(accounts)) delete accounts[key]
    adminIds.clear()
    memberRoleId.clear()

    for (const row of rows) {
      accounts[row.id] = {
        id: row.id,
        name: row.name,
        email: row.email,
        passwordHash: row.passwordHash
      }
      if (row.isAdmin) {
        adminIds.add(row.id)
      } else if (row.roleId !== DEFAULT_ROLE) {
        memberRoleId.set(row.id, row.roleId)
      }
      // 初始化遊戲／餘額等使用者狀態（跟 createMember() 對新帳號做的事一致；
      // 錢包/遊戲紀錄本身不在本次 Postgres 遷移範圍，每次重啟仍會重置，見 proposal.md）
      new UsersClass(row.id)
    }
  }
}
