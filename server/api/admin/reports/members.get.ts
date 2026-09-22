import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/**
 * 會員月度玩法分佈 API
 * GET /api/admin/reports/members?month=YYYY-MM
 *
 * 統計「當月至少玩過一次的不重複會員數」（依 userId 去重，同一人玩多次也只算一次），
 * 分 BG（彩票）／TW（台彩）／GAME（game-hall 像素小遊戲）三類，各自算出每款玩法的人數排行。
 * 跟 bg-summary.get.ts 的「銷售額排行」是不同維度（那邊看金額，這邊看人數）。
 * `npc` 子物件是僅 NPC 角色會員的同形狀統計，上方欄位是全部會員（含 NPC）合計。
 *
 * @param month 月份字串，格式 YYYY-MM（必填）
 */

// ── 台彩彩種（依下注時間 createdAt 篩月份）───────────────────────────────
const TW_GAME_NAMES: Record<string, string> = {
  'DLT': '大樂透',
  'SUPERLOTTO': '威力彩',
  'D539': '今彩539',
  'M649': '49樂合彩',
  'M539': '39樂合彩',
  'P3': '3星彩',
  'P4': '4星彩',
  'BINGO': '賓果賓果',
}
const TW_LOTTERY_KEYS = new Set(Object.keys(TW_GAME_NAMES))

// ── BG 彩種（依 issue 前 8 碼日期篩月份）─────────────────────────────────
const GAME_NAMES: Record<string, string> = {
  'LHC-OF': '六合彩',
  'LHC-CD': '六合彩(信用)',
  'K3-CD': '快3(信用)',
  'K3-OF': '快3',
  'PK10-CD': 'PK10(信用)',
  'PK10-OF': 'PK10',
  'SSC-CD': '時時彩(信用)',
  'SSC-OF': '時時彩',
  'X5-CD': '11選5(信用)',
  'X5-OF': '11選5',
  'EGGS': 'PC蛋蛋',
  'KL10': '快樂十分',
  'KL8': '快樂8',
  'FC3D': '福彩3D',
  'PL3': '排列3',
}

/**
 * 從 issue 字串前 8 碼解析 YYYY-MM-DD（比照 bg-summary.get.ts 的既有邏輯）
 */
function parseIssueDate(issue: string): string | null {
  if (!issue || issue.length < 8) return null
  const prefix = issue.replace(/\D/g, '').slice(0, 8)
  if (prefix.length < 8 || !/^\d{8}$/.test(prefix)) return null
  const y = prefix.slice(0, 4)
  const m = prefix.slice(4, 6)
  const d = prefix.slice(6, 8)
  const mNum = parseInt(m, 10)
  const dNum = parseInt(d, 10)
  if (mNum < 1 || mNum > 12 || dNum < 1 || dNum > 31) return null
  return `${y}-${m}-${d}`
}

function tsToDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type RankItem = { key: string; name: string; players: number; ratio: number }
type CategoryResult = { totalPlayers: number; gameRanking: RankItem[] }

/** 把「每款玩法 → 不重複 userId 集合」轉成排行（依人數排序，ratio 為佔各玩法人數加總的比例） */
function buildRanking(playerSets: Record<string, Set<string>>, nameOf: (key: string) => string): CategoryResult {
  const allPlayers = new Set<string>()
  Object.values(playerSets).forEach((set) => set.forEach((userId) => allPlayers.add(userId)))

  const entries = Object.entries(playerSets).map(([key, set]) => ({ key, players: set.size }))
  const sumPlayers = entries.reduce((acc, cur) => acc + cur.players, 0) || 1
  const gameRanking = entries
    .map(({ key, players }) => ({
      key,
      name: nameOf(key),
      players,
      ratio: Math.round((players / sumPlayers) * 10000) / 100,
    }))
    .sort((a, b) => b.players - a.players)

  return { totalPlayers: allPlayers.size, gameRanking }
}

/** 從「每款玩法 → 不重複 userId 集合」篩出僅 NPC 角色會員的子集合 */
function filterNpc(playerSets: Record<string, Set<string>>, isNpc: (userId: string) => boolean): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {}
  for (const [key, set] of Object.entries(playerSets)) {
    const npcSet = new Set<string>()
    set.forEach((userId) => { if (isNpc(userId)) npcSet.add(userId) })
    out[key] = npcSet
  }
  return out
}

export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)

  const query = getQuery(event)
  const month = String(query.month ?? '').trim()
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw createError({ statusCode: 400, message: 'month 參數為必填，格式須為 YYYY-MM' })
  }

  const access = Storage.manager.admin.access
  const isNpc = (userId: string) => access.roleOf(userId) === 'npc'

  // ── BG／TW：從彩票訂單去重 userId ──────────────────────────────────────
  const ordersMap = Storage.lottery.orders as Record<
    string,
    { orders: Record<string, Array<{ issue: string; userId: string; createdAt?: number }>> }
  >
  const bgPlayers: Record<string, Set<string>> = {}
  const twPlayers: Record<string, Set<string>> = {}

  for (const [gameKey, instance] of Object.entries(ordersMap)) {
    if (!instance || typeof instance.orders !== 'object') continue
    const isTw = TW_LOTTERY_KEYS.has(gameKey)
    for (const [_issue, rows] of Object.entries(instance.orders)) {
      if (!Array.isArray(rows)) continue
      for (const row of rows) {
        const userId = String(row.userId ?? '')
        if (!userId) continue

        if (isTw) {
          const ts = Number(row.createdAt ?? 0)
          if (!ts || !tsToDate(ts).startsWith(month)) continue
          if (!twPlayers[gameKey]) twPlayers[gameKey] = new Set()
          twPlayers[gameKey].add(userId)
          continue
        }

        const dateStr = parseIssueDate(row.issue ?? _issue)
        if (!dateStr || !dateStr.startsWith(month)) continue
        if (!bgPlayers[gameKey]) bgPlayers[gameKey] = new Set()
        bgPlayers[gameKey].add(userId)
      }
    }
  }

  // ── GAME（game-hall 像素小遊戲）：從 retro 遊玩紀錄去重 userId ───────────
  const historyMap = Storage.retroGames.history as Record<string, { records?: Record<string, Array<{ playedAt: string }>> }>
  const instancesMap = Storage.retroGames.instances as Record<string, { name?: string }>
  const gamePlayers: Record<string, Set<string>> = {}

  for (const [gameKey, historyInst] of Object.entries(historyMap)) {
    const records = historyInst?.records
    if (!records || typeof records !== 'object') continue
    for (const [userId, rows] of Object.entries(records)) {
      if (!Array.isArray(rows)) continue
      const playedThisMonth = rows.some((row) => String(row.playedAt ?? '').startsWith(month))
      if (!playedThisMonth) continue
      if (!gamePlayers[gameKey]) gamePlayers[gameKey] = new Set()
      gamePlayers[gameKey].add(userId)
    }
  }

  return {
    month,
    bg: buildRanking(bgPlayers, (key) => GAME_NAMES[key] ?? key),
    tw: buildRanking(twPlayers, (key) => TW_GAME_NAMES[key] ?? key),
    game: buildRanking(gamePlayers, (key) => instancesMap[key]?.name ?? key),
    npc: {
      bg: buildRanking(filterNpc(bgPlayers, isNpc), (key) => GAME_NAMES[key] ?? key),
      tw: buildRanking(filterNpc(twPlayers, isNpc), (key) => TW_GAME_NAMES[key] ?? key),
      game: buildRanking(filterNpc(gamePlayers, isNpc), (key) => instancesMap[key]?.name ?? key),
    },
    dataNote: '資料為 in-memory，伺服器重啟後清空。「人數」為當月至少玩過一次的不重複會員數（依 userId 去重，同一人玩多次也只算一次；同一人玩多款玩法會分別計入各款，故加總可能大於當類別總人數）。BG 依 issue 日期篩選；台彩依下注時間（createdAt）篩選；GAME 依遊玩時間（playedAt）篩選。以上數字為全部會員（含 NPC）合計，npc 欄位是其中 NPC 角色會員的部分。',
  }
})
