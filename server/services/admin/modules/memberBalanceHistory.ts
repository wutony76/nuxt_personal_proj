import { Storage } from 'serv/services/storage'
import { queryArchivedWalletChangesForUser } from 'serv/services/walletReportQuery'

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
  { key: 'eggsRecord', label: 'PC蛋蛋' },
  { key: 'dltRecord', label: '大樂透' },
  { key: 'superlottoRecord', label: '威力彩' },
  { key: 'd539Record', label: '今彩539' },
  { key: 'm649Record', label: '49樂合彩' },
  { key: 'm539Record', label: '39樂合彩' },
  { key: 'p3Record', label: '3星彩' },
  { key: 'p4Record', label: '4星彩' },
  { key: 'bingoRecord', label: '賓果賓果' }
]

const MAX_ROWS = 300

const _labelOf = new Map(USER_BALANCE_SOURCES.map((s) => [s.key, s.label]))

/**
 * 後台：彙總會員跨彩種／遊戲的 F幣 balanceChanges（記憶體近期 + DB 完整歷史合併，見
 * openspec/changes/fix-member-balance-history-tw-gap/design.md 第 2 節）。
 */
export const memberBalanceHistoryService = {
  /**
   * @param userId 帳號 id
   * @returns 依時間新到舊的異動列表
   */
  list: async (userId: string): Promise<AdminMemberBalanceChange[]> => {
    const accounts = Storage.get.account()
    if (!accounts[userId]) {
      throw createError({ statusCode: 404, message: '找不到該帳號。' })
    }

    Storage.get.user(userId)
    const user = Storage.users[userId] as Record<string, unknown> | undefined

    const rows: AdminMemberBalanceChange[] = []
    const seenIds = new Set<string>()
    if (user) {
      for (const { key, label } of USER_BALANCE_SOURCES) {
        const slice = user[key] as UserRecordSlice | undefined
        if (!Array.isArray(slice?.balanceChanges)) continue
        for (const row of slice.balanceChanges) {
          const id = `${key}:${row.id}`
          seenIds.add(id)
          rows.push({
            id,
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
    }

    const archived = await queryArchivedWalletChangesForUser(userId)
    for (const row of archived) {
      const id = `${row.source}:${row.id}`
      if (seenIds.has(id)) continue
      rows.push({
        id,
        source: row.source,
        sourceLabel: _labelOf.get(row.source) ?? row.source,
        issue: row.issue,
        type: row.type,
        amount: row.amount,
        before: row.before,
        after: row.after,
        createdAt: row.createdAt,
        note: row.note
      })
    }

    return rows.toSorted((a, b) => b.createdAt - a.createdAt).slice(0, MAX_ROWS)
  }
}
