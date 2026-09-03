import { ADMIN_USER_IDS } from 'serv/config/admin'
import { Storage } from 'serv/services/storage'
import { encodePasswordBcjs } from 'serv/utils/encrypt'
import UsersClass from 'serv/services/users'
import type { AuthRecord } from 'serv/types/storage'
import { walletBalanceService } from 'serv/services/walletBalance'

export type UserRole = 'admin' | 'user'

export type AdminAccessUser = {
  id: string
  name: string
  email: string
  role: UserRole
  /** F幣餘額（Storage.users[userId].coin） */
  coin: number
}

/** 執行期白名單；啟動時自程式碼常數複製，重啟回復。 */
const adminIds = new Set<string>(ADMIN_USER_IDS)

const MAX_NAME_LENGTH = 40
const MIN_PASSWORD_LENGTH = 6
const MAX_PASSWORD_LENGTH = 72
const MAX_COIN_ADD = 100_000_000

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
    role: (adminIds.has(row.id) ? 'admin' : 'user') as UserRole,
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

    return _toAdminUser(row)
  },

  /**
   * 重設會員登入密碼
   * @param userId 目標帳號
   * @param password 新明文密碼
   * @returns 更新後的帳號列（不回傳密碼）
   */
  setPassword: (userId: string, password: string): AdminAccessUser => {
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

    row.passwordHash = encodePasswordBcjs(next)
    return _toAdminUser(row)
  },

  /**
   * 更新會員登入 Email
   * @param userId 目標帳號
   * @param email 新 email
   * @returns 更新後的帳號列
   */
  setEmail: (userId: string, email: string): AdminAccessUser => {
    const accounts = Storage.get.account()
    const row = accounts[userId]
    if (!row) throw createError({ statusCode: 404, message: '找不到該帳號。' })

    const next = _normalizeEmail(email)
    _validateEmail(next)
    if (next !== row.email) {
      _assertEmailAvailable(next, userId)
      row.email = next
      _syncSessionEmail(userId, next)
    }
    return _toAdminUser(row)
  },

  /**
   * 調整會員 F幣（正數充值、負數扣款）
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
   * 新增會員帳號（in-memory）
   * @param input.name 顯示名
   * @param input.email 登入 email（全站唯一，含 @admin 網域）
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
    const email = _normalizeEmail(input.email)
    const password = String(input.password ?? '')
    const role: UserRole = input.role === 'admin' ? 'admin' : 'user'

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

    accounts[id] = {
      id,
      name,
      email,
      passwordHash: encodePasswordBcjs(password)
    }
    // 初始化遊戲／餘額等使用者狀態
    new UsersClass(id)

    if (role === 'admin') adminIds.add(id)

    return _toAdminUser(accounts[id]!)
  }
}
