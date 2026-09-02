import { Storage } from './storage'

/** 錢包層級異動類型（寫入 user.record.balanceChanges） */
export type WalletBalanceChangeType = 'admin-topup' | 'admin-deduct' | 'game-reward'

export type WalletBalanceChange = {
  id: string
  issue: string
  type: string
  amount: number
  before: number
  after: number
  createdAt: number
  note: string
}

type UserWalletLike = {
  coin: number
  record?: {
    balanceChanges: WalletBalanceChange[]
    betHistory: unknown[]
    claimableIssues: unknown[]
    updatedAt: number
  }
}

const MAX_CHANGES = 5000
const TRIM_TO = 4000

/** 需合併進各彩種「餘額變動表」的錢包層級類型 */
const DIALOG_WALLET_TYPES = new Set<string>(['admin-topup', 'admin-deduct', 'game-reward'])

/**
 * @param user 使用者儲存列
 * @returns 確保存在的 record
 */
function _ensureRecord(user: UserWalletLike) {
  if (!user.record) {
    user.record = { balanceChanges: [], betHistory: [], claimableIssues: [], updatedAt: Date.now() }
  }
  if (!Array.isArray(user.record.balanceChanges)) user.record.balanceChanges = []
  return user.record
}

/**
 * 錢包 F幣異動與 balanceChanges 稽核紀錄。
 */
export const walletBalanceService = {
  /**
   * 追加一筆錢包異動並更新 coin
   * @param userId 帳號 id
   * @param input.type 異動類型
   * @param input.amount 變動量（加為正、扣為負）
   * @param input.note 備註
   * @param input.issue 期數（可空）
   * @returns 異動後餘額
   */
  appendChange: (
    userId: string,
    input: { type: WalletBalanceChangeType | string; amount: number; note: string; issue?: string }
  ): number => {
    const user = Storage.get.user(userId) as UserWalletLike
    const record = _ensureRecord(user)
    const before = Number(user.coin ?? 0)
    const delta = Number(input.amount)
    const after = Number((before + delta).toFixed(2))

    if (after < 0) {
      throw createError({ statusCode: 400, message: '餘額不足，無法扣款。' })
    }

    user.coin = after
    record.balanceChanges.push({
      id: `wallet-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      issue: input.issue ?? '',
      type: input.type,
      amount: delta,
      before,
      after,
      createdAt: Date.now(),
      note: input.note
    })
    if (record.balanceChanges.length > MAX_CHANGES) {
      record.balanceChanges = record.balanceChanges.slice(-TRIM_TO)
    }
    record.updatedAt = Date.now()
    return after
  },

  /**
   * 錢包層級異動（供彩種餘額變動表合併）
   * @param userId 帳號 id
   * @returns 異動列表
   */
  listForDialog: (userId: string): WalletBalanceChange[] => {
    const user = Storage.get.user(userId) as UserWalletLike
    return (user.record?.balanceChanges ?? []).filter((row) => DIALOG_WALLET_TYPES.has(row.type))
  },

  /**
   * 合併彩種 record 與錢包層級異動，依時間新到舊
   * @param userId 帳號 id
   * @param gameChanges 彩種自身 balanceChanges
   * @returns 合併後列表
   */
  mergeForDialog: (userId: string, gameChanges: WalletBalanceChange[]): WalletBalanceChange[] => {
    const merged = new Map<string, WalletBalanceChange>()
    for (const row of [...gameChanges, ...walletBalanceService.listForDialog(userId)]) {
      merged.set(row.id, row)
    }
    return [...merged.values()].sort((a, b) => b.createdAt - a.createdAt)
  }
}
