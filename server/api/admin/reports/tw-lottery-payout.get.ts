import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

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
  issue: string
  betTime: number
  winStatus: string
  winAmount: number
}

type UserLike = Record<string, { betHistory?: BetHistoryRow[] } | undefined>

/**
 * 後台：台彩鏡射玩法（彩運來）中獎派彩月報
 * @returns 月 KPI + 各玩法中獎彩總 + 中獎明細（含期別）
 */
export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)

  const query = getQuery(event)
  const month = String(query.month ?? '').trim()

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw createError({ statusCode: 400, message: 'month 參數為必填，格式須為 YYYY-MM' })
  }

  // 各玩法派彩
  const gameMap: Record<string, { amount: number; count: number }> = {}
  for (const g of TW_RECORDS) gameMap[g.key] = { amount: 0, count: 0 }

  // 中獎明細（逐注，含期別）
  const records: Array<{ time: number; timeStr: string; issue: string; key: string; name: string; amount: number }> = []

  const users = Storage.users as Record<string, UserLike>

  for (const user of Object.values(users)) {
    for (const g of TW_RECORDS) {
      const rows = user?.[g.field]?.betHistory ?? []
      for (const row of rows) {
        if (row.winStatus !== 'win') continue
        const dateStr = tsToDate(row.betTime)
        if (!dateStr.startsWith(month)) continue

        const amount = Number(row.winAmount ?? 0)
        gameMap[g.key].amount += amount
        gameMap[g.key].count += 1
        records.push({
          time: row.betTime,
          timeStr: tsToDateTime(row.betTime),
          issue: row.issue,
          key: g.key,
          name: g.name,
          amount,
        })
      }
    }
  }

  records.sort((a, b) => b.time - a.time)

  const perGame = TW_RECORDS
    .map((g) => ({
      key: g.key,
      name: g.name,
      amount: Math.round(gameMap[g.key].amount * 100) / 100,
      count: gameMap[g.key].count,
    }))
    .sort((a, b) => b.amount - a.amount)

  const totalPayout = perGame.reduce((sum, g) => sum + g.amount, 0)

  return {
    month,
    totalPayout: Math.round(totalPayout * 100) / 100,
    totalCount: perGame.reduce((sum, g) => sum + g.count, 0),
    perGame,
    records,
    dataNote: '資料為本系統實際下注紀錄（in-memory，伺服器重啟後清空）。以「開獎判定為中獎」的注單金額計算，依下注時間所屬日期歸類，不代表玩家已實際請領。',
  }
})
