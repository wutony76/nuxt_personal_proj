import { Storage } from '../storage'

export type AdminMemberBalanceChange = {
  id: string
  source: string
  sourceLabel: string
  issue: string
  type: string
  amount: number
  before: number
  after: number
  createdAt: number
  note: string
}

type BalanceRow = {
  id: string
  issue?: string
  type: string
  amount: number
  before: number
  after: number
  createdAt: number
  note?: string
}

type UserRecordSlice = {
  balanceChanges?: BalanceRow[]
}

/** 使用者物件上各彩種／錢包 record 欄位 */
const USER_BALANCE_SOURCES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'record', label: '錢包／六合彩' },
  { key: 'k3Record', label: '快3信用' },
  { key: 'k3OfRecord', label: '快3官方' },
  { key: 'pk10Record', label: 'PK10信用' },
  { key: 'pk10OfRecord', label: 'PK10官方' },
  { key: 'x5Record', label: '11選5信用' },
  { key: 'x5OfRecord', label: '11選5官方' },
  { key: 'sscRecord', label: '時時彩信用' },
  { key: 'sscOfRecord', label: '時時彩官方' },
  { key: 'fc3dRecord', label: '福彩3D' },
  { key: 'pl3Record', label: '排列3' },
  { key: 'kl8Record', label: '快樂8' },
  { key: 'kl10Record', label: '快樂10' },
  { key: 'eggsRecord', label: 'PC蛋蛋' }
]

const MAX_ROWS = 300

/**
 * 後台：彙總會員跨彩種／遊戲的 F幣 balanceChanges。
 */
export const memberBalanceHistoryService = {
  /**
   * @param userId 帳號 id
   * @returns 依時間新到舊的異動列表
   */
  list: (userId: string): AdminMemberBalanceChange[] => {
    const accounts = Storage.get.account()
    if (!accounts[userId]) {
      throw createError({ statusCode: 404, message: '找不到該帳號。' })
    }

    Storage.get.user(userId)
    const user = Storage.users[userId] as Record<string, unknown> | undefined
    if (!user) return []

    const rows: AdminMemberBalanceChange[] = []
    for (const { key, label } of USER_BALANCE_SOURCES) {
      const slice = user[key] as UserRecordSlice | undefined
      if (!Array.isArray(slice?.balanceChanges)) continue
      for (const row of slice.balanceChanges) {
        rows.push({
          id: `${key}:${row.id}`,
          source: key,
          sourceLabel: label,
          issue: String(row.issue ?? ''),
          type: String(row.type ?? ''),
          amount: Number(row.amount ?? 0),
          before: Number(row.before ?? 0),
          after: Number(row.after ?? 0),
          createdAt: Number(row.createdAt ?? 0),
          note: String(row.note ?? '')
        })
      }
    }

    return rows.toSorted((a, b) => b.createdAt - a.createdAt).slice(0, MAX_ROWS)
  }
}
