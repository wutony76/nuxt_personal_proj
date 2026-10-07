import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'
import { TOY_CATALOG } from 'serv/services/game/toys/catalog'
import { queryArchivedWalletChangesForMonth } from 'serv/services/walletReportQuery'

const TOY_NAMES = new Set(TOY_CATALOG.map((t) => t.name))

/** 依遊戲名稱判斷屬於柑仔店玩具（toys）還是遊戲中心小遊戲（retro） */
function categorize(gameName: string): 'toys' | 'retro' {
  return TOY_NAMES.has(gameName) ? 'toys' : 'retro'
}

/** 從 note 字串前綴抽取玩具遊戲名稱 */
function extractGameName(note: string): string {
  const m = note.match(/^(.+?)(?:下注|結算|達標|領取|遊戲結算)/)
  return (m?.[1] ?? '').trim() || '其他'
}

/** 將毫秒時間戳轉為 YYYY-MM-DD */
function tsToDate(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

/** 產生指定月份所有日期 */
function getDaysInMonth(month: string): string[] {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  const days: string[] = []
  const count = new Date(y, m, 0).getDate()
  for (let d = 1; d <= count; d++) {
    days.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return days
}

type BalanceChange = {
  id?: string
  type: string
  amount: number
  note: string
  createdAt: number
}

type UserLike = {
  record?: {
    balanceChanges?: BalanceChange[]
  }
}

type Bucket = {
  dailyBet: Record<string, number>
  dailyReward: Record<string, number>
  gameMap: Record<string, { bet: number; reward: number; count: number }>
}

function _emptyBucket(): Bucket {
  return { dailyBet: {}, dailyReward: {}, gameMap: {} }
}

function _accumulate(bucket: Bucket, gameName: string, dateStr: string, type: string, amt: number): void {
  if (!bucket.gameMap[gameName]) bucket.gameMap[gameName] = { bet: 0, reward: 0, count: 0 }
  bucket.gameMap[gameName].count += 1

  if (type === 'toy-bet') {
    const spent = Math.abs(amt)
    bucket.dailyBet[dateStr] = (bucket.dailyBet[dateStr] ?? 0) + spent
    bucket.gameMap[gameName].bet += spent
  } else {
    bucket.dailyReward[dateStr] = (bucket.dailyReward[dateStr] ?? 0) + amt
    bucket.gameMap[gameName].reward += amt
  }
}

function _summarize(bucket: Bucket, month: string) {
  const totalBet = Object.values(bucket.dailyBet).reduce((a, b) => a + b, 0)
  const totalReward = Object.values(bucket.dailyReward).reduce((a, b) => a + b, 0)
  const days = getDaysInMonth(month)
  const dailyFlow = days.map((day) => ({
    day,
    bet: bucket.dailyBet[day] ?? 0,
    reward: bucket.dailyReward[day] ?? 0,
  }))
  const perGame = Object.entries(bucket.gameMap)
    .map(([name, v]) => ({
      name,
      category: categorize(name),
      bet: v.bet,
      reward: v.reward,
      net: Math.round((v.reward - v.bet) * 100) / 100,
      count: v.count,
    }))
    .sort((a, b) => b.bet - a.bet)

  return {
    totalBet: Math.round(totalBet * 100) / 100,
    totalReward: Math.round(totalReward * 100) / 100,
    netFlow: Math.round((totalReward - totalBet) * 100) / 100,
    dailyFlow,
    perGame,
  }
}

/**
 * 後台：Game Center F幣 兌換月報
 * @returns 月 KPI + 每日流水 + 每款玩具明細（含 npc 子物件：僅 NPC 角色會員的同形狀統計）
 */
export default defineEventHandler(async (event) => {
  sessionController.requireAdminView(event)

  const query = getQuery(event)
  const month = String(query.month ?? '').trim()

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw createError({ statusCode: 400, message: 'month 參數為必填，格式須為 YYYY-MM' })
  }

  const allBucket = _emptyBucket()
  const npcBucket = _emptyBucket()

  const users = Storage.users as Record<string, UserLike>
  const access = Storage.manager.admin.access

  // 記憶體（近期，每人 record.balanceChanges 上限 5000→4000）+ DB（wallet_balance_changes
  // 的 source='record' 全量快照，完整歷史）合併，以 id 去重（記憶體版本優先），見
  // migrate-wallet-and-reports-postgres/design.md 第 4c 節。DB 查詢已先用 created_at 粗篩
  // 當月範圍，實際的月份判斷仍交給下面迴圈既有的 tsToDate()/startsWith() 做本地時區精確判斷。
  const archivedRows = (await queryArchivedWalletChangesForMonth(month))
    .filter((c) => c.source === 'record' && (c.type === 'toy-bet' || c.type === 'toy-reward' || c.type === 'game-reward'))
  const archivedByUser = new Map<string, typeof archivedRows>()
  for (const row of archivedRows) {
    if (!archivedByUser.has(row.userId)) archivedByUser.set(row.userId, [])
    archivedByUser.get(row.userId)!.push(row)
  }

  const allUserIds = new Set([...Object.keys(users), ...archivedByUser.keys()])

  for (const userId of allUserIds) {
    const isNpc = access.roleOf(userId) === 'npc'
    const memoryChanges = users[userId]?.record?.balanceChanges ?? []
    const memoryIds = new Set(memoryChanges.map((c) => c.id))
    const archived = (archivedByUser.get(userId) ?? []).filter((c) => !memoryIds.has(c.id))
    const changes: BalanceChange[] = [...memoryChanges, ...archived]

    for (const ch of changes) {
      if (ch.type !== 'toy-bet' && ch.type !== 'toy-reward' && ch.type !== 'game-reward') continue
      const dateStr = tsToDate(ch.createdAt)
      if (!dateStr.startsWith(month)) continue

      const amt = Number(ch.amount ?? 0)
      const gameName = extractGameName(ch.note ?? '')

      _accumulate(allBucket, gameName, dateStr, ch.type, amt)
      if (isNpc) _accumulate(npcBucket, gameName, dateStr, ch.type, amt)
    }
  }

  const all = _summarize(allBucket, month)
  const npc = _summarize(npcBucket, month)

  return {
    month,
    ...all,
    npc,
    dataNote: '資料為記憶體（近期）+ PostgreSQL（完整歷史，DB 啟用時才有）合併。統計 toy-bet、'
      + 'toy-reward、game-reward 三類 F幣 流水；以上數字為全部會員（含 NPC）合計，npc 欄位是其中 '
      + 'NPC 角色會員的部分。',
  }
})
