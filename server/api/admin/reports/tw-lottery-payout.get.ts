import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'
import { queryArchivedTwPayoutsForMonth } from 'serv/services/walletReportQuery'

/** 台彩鏡射玩法：user 物件上各玩法的注單/餘額紀錄欄位名稱與顯示名稱 */
const TW_RECORDS = [
  { key: 'DLT', field: 'dltRecord', name: '大樂透' },
  { key: 'SUPERLOTTO', field: 'superlottoRecord', name: '威力彩' },
  { key: 'D539', field: 'd539Record', name: '今彩539' },
  { key: 'M649', field: 'm649Record', name: '49樂合彩' },
  { key: 'M539', field: 'm539Record', name: '39樂合彩' },
  { key: 'P3', field: 'p3Record', name: '3星彩' },
  { key: 'P4', field: 'p4Record', name: '4星彩' },
  { key: 'BINGO', field: 'bingoRecord', name: '賓果賓果' },
] as const

/** 將毫秒時間戳轉為 YYYY-MM-DD */
function tsToDate(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

/** 將毫秒時間戳轉為 YYYY-MM-DD HH:mm */
function tsToDateTime(ts: number): string {
  const d = new Date(ts)
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${tsToDate(ts)} ${time}`
}

type BetHistoryRow = {
  orderId: string
  issue: string
  betTime: number
  winStatus: string
  winAmount: number
}

type UserLike = Record<string, { betHistory?: BetHistoryRow[] } | undefined>

type RecordRow = { time: number; timeStr: string; issue: string; key: string; name: string; amount: number; isNpc: boolean }

function _perGameOf(gameMap: Record<string, { amount: number; count: number }>) {
  return TW_RECORDS
    .map((g) => ({
      key: g.key,
      name: g.name,
      amount: Math.round(gameMap[g.key].amount * 100) / 100,
      count: gameMap[g.key].count,
    }))
    .sort((a, b) => b.amount - a.amount)
}

/**
 * 後台：台彩鏡射玩法（彩運來）中獎派彩月報
 * @returns 月 KPI + 各玩法中獎彩總 + 中獎明細（含期別，含 npc 子物件：僅 NPC 角色會員的
 * 同形狀統計；`records` 每筆多帶 `isNpc` 供前端篩選）
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdminView(event)

  const query = getQuery(event)
  const month = String(query.month ?? '').trim()

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw createError({ statusCode: 400, message: 'month 參數為必填，格式須為 YYYY-MM' })
  }

  const gameMap: Record<string, { amount: number; count: number }> = {}
  const npcGameMap: Record<string, { amount: number; count: number }> = {}
  for (const g of TW_RECORDS) {
    gameMap[g.key] = { amount: 0, count: 0 }
    npcGameMap[g.key] = { amount: 0, count: 0 }
  }

  const records: RecordRow[] = []

  const users = Storage.users as Record<string, UserLike>
  const access = Storage.manager.admin.access

  // 記憶體（近期，betHistory 無上限但重啟即清空）+ DB（tw_payout_events 全量快照，只收
  // winStatus='win' 的列，完整歷史）合併，以 (field, orderId) 去重（記憶體版本優先），見
  // migrate-wallet-and-reports-postgres/design.md 第 4d 節。
  const archivedRows = await queryArchivedTwPayoutsForMonth(month)
  const archivedByUser = new Map<string, typeof archivedRows>()
  for (const row of archivedRows) {
    if (!archivedByUser.has(row.userId)) archivedByUser.set(row.userId, [])
    archivedByUser.get(row.userId)!.push(row)
  }

  const allUserIds = new Set([...Object.keys(users), ...archivedByUser.keys()])

  for (const userId of allUserIds) {
    const isNpc = access.roleOf(userId) === 'npc'
    const archivedForUser = archivedByUser.get(userId) ?? []
    for (const g of TW_RECORDS) {
      const memoryRows = users[userId]?.[g.field]?.betHistory ?? []
      const memoryOrderIds = new Set(memoryRows.map((row) => row.orderId))
      const archivedRowsForField = archivedForUser
        .filter((row) => row.source === g.field && !memoryOrderIds.has(row.orderId))
        .map((row) => ({ orderId: row.orderId, issue: row.issue, betTime: row.createdAt, winStatus: 'win', winAmount: row.amount }))

      for (const row of [...memoryRows, ...archivedRowsForField]) {
        if (row.winStatus !== 'win') continue
        const dateStr = tsToDate(row.betTime)
        if (!dateStr.startsWith(month)) continue

        const amount = Number(row.winAmount ?? 0)
        gameMap[g.key].amount += amount
        gameMap[g.key].count += 1
        if (isNpc) {
          npcGameMap[g.key].amount += amount
          npcGameMap[g.key].count += 1
        }
        records.push({
          time: row.betTime,
          timeStr: tsToDateTime(row.betTime),
          issue: row.issue,
          key: g.key,
          name: g.name,
          amount,
          isNpc,
        })
      }
    }
  }

  records.sort((a, b) => b.time - a.time)

  const perGame = _perGameOf(gameMap)
  const npcPerGame = _perGameOf(npcGameMap)
  const totalPayout = perGame.reduce((sum, g) => sum + g.amount, 0)
  const npcTotalPayout = npcPerGame.reduce((sum, g) => sum + g.amount, 0)

  return {
    month,
    totalPayout: Math.round(totalPayout * 100) / 100,
    totalCount: perGame.reduce((sum, g) => sum + g.count, 0),
    perGame,
    records,
    npc: {
      totalPayout: Math.round(npcTotalPayout * 100) / 100,
      totalCount: npcPerGame.reduce((sum, g) => sum + g.count, 0),
      perGame: npcPerGame,
    },
    dataNote: '資料為記憶體（近期）+ PostgreSQL（完整歷史，DB 啟用時才有）合併。以「開獎判定為中獎」'
      + '的注單金額計算，依下注時間所屬日期歸類，不代表玩家已實際請領。以上數字為全部會員（含 NPC）'
      + '合計，npc 欄位是其中 NPC 角色會員的部分。',
  }
})
