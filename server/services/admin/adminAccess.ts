import { ADMIN_USER_IDS } from '../../config/admin'
import { Storage } from '../storage'
import { encodePasswordBcjs } from '../../utils/encrypt'
import UsersClass from '../users'
import type { AuthRecord } from '../../types/storage'

export type UserRole = 'admin' | 'user'

export type AdminAccessUser = {
  id: string
  name: string
  email: string
  role: UserRole
}

/** 執行期白名單；啟動時自程式碼常數複製，重啟回復。 */
const adminIds = new Set<string>(ADMIN_USER_IDS)

const MAX_NAME_LENGTH = 40
const MIN_PASSWORD_LENGTH = 6
const MAX_PASSWORD_LENGTH = 72

function _uid(): string {
  return `U0xA${Date.now().toString(16).slice(-6)}${Math.random().toString(16).slice(2, 6)}`.toUpperCase()
}

/** @admin 網域測試用 Email 可重複建立（例：test@admin.hfyy） */
function _isReusableAdminEmail(email: string): boolean {
  return email.includes('@admin')
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
   * 列出全部帳號與角色（名稱排序）
   * @returns 帳號列表
   */
  listUsers: (): AdminAccessUser[] => {
    const accounts = Storage.get.account()
    return Object.values(accounts)
      .map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: (adminIds.has(row.id) ? 'admin' : 'user') as UserRole
      }))
      .toSorted((a, b) => {
        if (a.role !== b.role) return a.role === 'admin' ? -1 : 1
        return a.name.localeCompare(b.name, 'zh-Hant')
      })
  },

  /**
   * 設定帳號角色
   * @param userId 目標帳號
   * @param role admin／user
   * @param actorId 操作者（不可自我降權）
   * @returns 更新後的帳號列
   */
  setRole: (userId: string, role: UserRole, actorId: string): AdminAccessUser => {
    const accounts = Storage.get.account()
    const row = accounts[userId]
    if (!row) throw createError({ statusCode: 404, message: '找不到該帳號。' })

    const next: UserRole = role === 'admin' ? 'admin' : 'user'
    const currentlyAdmin = adminIds.has(userId)

    if (next === 'admin') {
      adminIds.add(userId)
    } else {
      if (userId === actorId) {
        throw createError({ statusCode: 400, message: '不可將自己降為 User，以免失去後台權限。' })
      }
      if (currentlyAdmin && adminIds.size <= 1) {
        throw createError({ statusCode: 400, message: '至少需保留一位 Admin。' })
      }
      adminIds.delete(userId)
    }

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: adminIds.has(userId) ? 'admin' : 'user'
    }
  },

  /**
   * 新增會員帳號（in-memory）
   * @param input.name 顯示名
   * @param input.email 登入 email（一般唯一；含 @admin 可重複）
   * @param input.password 明文密碼
   * @param input.role 預設 user
   * @returns 新建帳號（不含密碼）
   */
  createMember: (input: {
    name: string
    email: string
    password: string
    role?: UserRole
  }): AdminAccessUser => {
    const name = String(input.name ?? '').trim()
    const email = String(input.email ?? '').trim().toLowerCase()
    const password = String(input.password ?? '')
    const role: UserRole = input.role === 'admin' ? 'admin' : 'user'

    if (!name) throw createError({ statusCode: 400, message: '請輸入名稱。' })
    if (name.length > MAX_NAME_LENGTH) {
      throw createError({ statusCode: 400, message: `名稱不能超過 ${MAX_NAME_LENGTH} 字。` })
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw createError({ statusCode: 400, message: '請輸入有效的 Email。' })
    }
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      throw createError({
        statusCode: 400,
        message: `密碼長度須為 ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} 字元。`
      })
    }

    Storage.get.account()
    const accounts = Storage.account as Record<string, AuthRecord>
    if (
      !_isReusableAdminEmail(email) &&
      Object.values(accounts).some((row) => row.email === email)
    ) {
      throw createError({ statusCode: 400, message: '此 Email 已被使用。' })
    }

    let id = _uid()
    while (accounts[id]) id = _uid()

    accounts[id] = {
      id,
      name,
      email,
      passwordHash: encodePasswordBcjs(password)
    }
    // 初始化遊戲／餘額等使用者狀態
    new UsersClass(id)

    if (role === 'admin') adminIds.add(id)

    return {
      id,
      name,
      email,
      role: adminIds.has(id) ? 'admin' : 'user'
    }
  }
}
