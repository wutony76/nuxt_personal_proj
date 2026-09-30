import { sessionController } from 'serv/services/auth'
import { adminAccessService } from 'serv/services/admin/modules/adminAccess'
import { Storage } from 'serv/services/storage'

const PAGE_SIZE = 200

/**
 * @typedef {Object} NpcActivityLogEntry
 * @property {string} id - 異動 id
 * @property {string} memberId - NPC 會員 id
 * @property {string} memberName - NPC 會員名稱
 * @property {string} type - 異動類型
 * @property {number} amount - 金額（正加負扣）
 * @property {number} before - 異動前餘額
 * @property {number} after - 異動後餘額
 * @property {string} note - 備註
 * @property {string} issue - 期數（可空）
 * @property {number} createdAt - 建立時間（ms）
 */

/**
 * 後台：查詢所有 NPC 會員的活動日誌（彙整 balanceChanges）。
 * 支援 memberId（單一 NPC）、types（逗號分隔）、cursor（分頁）查詢參數。
 * @returns { entries: NpcActivityLogEntry[], nextCursor: string | null }
 */
export default defineEventHandler((event) => {
  sessionController.requireAdminView(event)

  const query = getQuery(event)
  const memberIdFilter = typeof query.memberId === 'string' && query.memberId ? query.memberId : null
  const typesFilter = typeof query.types === 'string' && query.types
    ? new Set(query.types.split(',').map((t) => t.trim()).filter(Boolean))
    : null
  const cursor = typeof query.cursor === 'string' && query.cursor ? query.cursor : null

  // 取出 cursor 的 createdAt + id
  let cursorCreatedAt: number | null = null
  let cursorId: string | null = null
  if (cursor) {
    const sep = cursor.lastIndexOf('_')
    if (sep !== -1) {
      cursorCreatedAt = Number(cursor.slice(0, sep))
      cursorId = cursor.slice(sep + 1)
    }
  }

  // 取所有 NPC 會員
  const npcUsers = adminAccessService.listUsers().filter((u) => u.role === 'npc')
  const targets = memberIdFilter ? npcUsers.filter((u) => u.id === memberIdFilter) : npcUsers

  // 彙整所有 balanceChanges，附上 memberId / memberName
  type RawEntry = {
    id: string; memberId: string; memberName: string; type: string
    amount: number; before: number; after: number; note: string; issue: string; createdAt: number
  }

  const all: RawEntry[] = []
  for (const user of targets) {
    const userRecord = Storage.get.user(user.id) as {
      record?: { balanceChanges?: Array<{ id: string; type: string; amount: number; before: number; after: number; note: string; issue?: string; createdAt: number }> }
    }
    const changes = userRecord?.record?.balanceChanges ?? []
    for (const c of changes) {
      if (typesFilter && !typesFilter.has(c.type)) continue
      all.push({
        id: c.id,
        memberId: user.id,
        memberName: user.name,
        type: c.type,
        amount: c.amount,
        before: c.before,
        after: c.after,
        note: c.note,
        issue: c.issue ?? '',
        createdAt: c.createdAt
      })
    }
  }

  // 新→舊排序
  all.sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))

  // cursor 分頁：找到 cursor 位置後取 PAGE_SIZE 筆
  let startIdx = 0
  if (cursorCreatedAt !== null && cursorId !== null) {
    const idx = all.findIndex((e) => e.createdAt === cursorCreatedAt && e.id === cursorId)
    startIdx = idx === -1 ? all.length : idx + 1
  }

  const page = all.slice(startIdx, startIdx + PAGE_SIZE)
  const last = page[page.length - 1]
  const hasMore = startIdx + PAGE_SIZE < all.length
  const nextCursor = hasMore && last ? `${last.createdAt}_${last.id}` : null

  return { entries: page, nextCursor }
})
