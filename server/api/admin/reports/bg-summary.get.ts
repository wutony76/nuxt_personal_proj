import { sessionController } from 'serv/services/auth'
import { Storage } from 'serv/services/storage'

/**
 * BG 彩票月度統計 API
 * GET /api/admin/reports/bg-summary?month=YYYY-MM
 *
 * @param month 月份字串，格式 YYYY-MM（必填）
 * @returns 月度 KPI、每日銷售、彩種排行、玩法排行
 */

/** 彩種 key → 顯示名稱對照表 */
// ── 台彩彩種（issue 為民國年序號，無法按日期篩選，另外累計） ──────────────────────────
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

// ── BG 彩種 ──────────────────────────────────────────────────────────────────────────────
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
 * 玩法 key → 中文名稱對照表
 * 涵蓋所有 BG 彩票玩法（6hc-cd / k3-cd / k3-of / pk10-cd / pk10-of /
 * ssc-cd / ssc-of / x5-cd / x5-of / eggs / kl10 / kl8 / fc3d / pl3）
 */
const PLAY_NAMES: Record<string, string> = {
  // ── 六合彩（信用盤）──
  'tema': '特碼',
  'zhengma': '正碼',
  'zhengmate': '正碼特',
  'lianma': '連碼',
  'qima': '七碼',
  'wuxing': '五行',
  'banbo': '半波',
  'yixiao': '一肖',
  'texiao': '特肖',
  'hexiao': '合肖',
  'lianxiao': '連肖',
  'weishu': '尾數',
  'lianwei': '連尾',
  'zixuanbuzhong': '全不中',
  'duoxuanzhongyi': '中一',
  'zhengterenzhong': '特平中',
  'ixiaolian': '一肖量',
  'weishulian': '尾數量',
  'shengxiao': '生肖',
  'touweishu': '頭尾數',
  // ── 快3（信用盤）──
  'sanjun': '三軍/大小/點數',
  'changduan': '長牌/短牌',
  'weitou': '圍骰/全骰',
  // ── 快3（官方盤）──
  'hezhi': '和值',
  'ertong': '二同號',
  'erbutong': '二不同號',
  'sanbutong': '三不同號',
  'santong': '三同號',
  'sanlian': '三連號',
  // ── PK10（信用盤）──
  'dingwei': '定位膽',
  'liangmian': '兩面',
  'zuhe': '冠亞組合',
  'guanyahe': '冠亞軍和',
  'longhu': '龍虎鬥',
  // ── PK10（官方盤）──
  'qianyi': '前一直選',
  'qianer': '前二直選',
  'qiansan': '前三直選',
  // ── 時時彩（信用盤）──
  'ball': '1-5球',
  'sanpai': '前中後三',
  'quan5': '全5中1',
  'douniu': '鬥牛',
  'suoha': '梭哈',
  // ── 時時彩（官方盤）──
  'erxing': '二星',
  'housan': '後三',
  'daxiao': '大小單雙',
  // ── 11選5（官方盤）──
  'sanma': '三碼',
  'erma': '二碼',
  'budingwei': '不定位',
  'renxuanfu': '任選複式',
  'renxuandan': '任選單式',
  'renxuandt': '任選膽拖',
  'quwei': '趣味玩法',
  // ── 福彩3D / 排列3（官方盤）──
  'zhixuan': '直選組選',
  'sanxing': '三星',
  // ── PC蛋蛋 ──
  'danshuang': '單雙',
  'tese': '特殊玩法',
  'sebo': '色波',
  // ── 快樂十分 / 快樂8 ──
  'zhenghe': '正和',
  'renxuan': '任選',
  // ── 彩池通用玩法（K3-OF / EGGS / KL10 / KL8）──
  'xuanhao': '選號（彩池）',
}

/**
 * 從 issue 字串前 8 碼解析 YYYY-MM-DD
 * @param issue 期號字串（如 20260917-001 或 20260917001）
 * @returns YYYY-MM-DD 或 null
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

/**
 * 產生指定月份的所有日期字串陣列（YYYY-MM-DD）
 * @param month YYYY-MM
 */
function getDaysInMonth(month: string): string[] {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  const days: string[] = []
  const daysCount = new Date(y, m, 0).getDate()
  for (let d = 1; d <= daysCount; d++) {
    days.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return days
}

export default defineEventHandler((event) => {
  sessionController.requireAdmin(event)

  const query = getQuery(event)
  const month = String(query.month ?? '').trim()

  // 驗證 month 格式
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw createError({ statusCode: 400, message: 'month 參數為必填，格式須為 YYYY-MM' })
  }

  const ordersMap = Storage.lottery.orders as Record<string, { orders: Record<string, Array<{ issue: string; coin: number; playKey?: string; createdAt?: number }>> }>

  // ── 輔助：毫秒 ts → YYYY-MM-DD ──────────────────────────────────────
  function tsToDate(ts: number): string {
    const d = new Date(ts)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  // 按日期聚合（BG 彩票，issue 帶日期可按月篩選）
  const dailyMap: Record<string, number> = {}
  const gameMap: Record<string, { sales: number; orders: number }> = {}
  const playMap: Record<string, { sales: number; orders: number }> = {}

  // 台彩（用 createdAt 按月篩選）
  const twDailyMap: Record<string, number> = {}
  const twGameMap: Record<string, { sales: number; orders: number }> = {}

  for (const [gameKey, instance] of Object.entries(ordersMap)) {
    if (!instance || typeof instance.orders !== 'object') continue
    const isTw = TW_LOTTERY_KEYS.has(gameKey)
    for (const [_issue, orderRows] of Object.entries(instance.orders)) {
      if (!Array.isArray(orderRows)) continue
      for (const row of orderRows) {
        const coin = Number(row.coin ?? 0)
        if (!Number.isFinite(coin) || coin <= 0) continue

        // ── 台彩：使用 createdAt 篩月份 ──
        if (isTw) {
          const ts = Number(row.createdAt ?? 0)
          if (!ts) continue
          const dateStr = tsToDate(ts)
          if (!dateStr.startsWith(month)) continue
          twDailyMap[dateStr] = (twDailyMap[dateStr] ?? 0) + coin
          if (!twGameMap[gameKey]) twGameMap[gameKey] = { sales: 0, orders: 0 }
          twGameMap[gameKey].sales += coin
          twGameMap[gameKey].orders += 1
          continue
        }

        // ── BG 彩票：使用 issue 前 8 碼篩月份 ──
        const dateStr = parseIssueDate(row.issue ?? _issue)
        if (!dateStr) continue
        if (!dateStr.startsWith(month)) continue

        // 每日銷售
        dailyMap[dateStr] = (dailyMap[dateStr] ?? 0) + coin

        // 彩種排行
        if (!gameMap[gameKey]) gameMap[gameKey] = { sales: 0, orders: 0 }
        gameMap[gameKey].sales += coin
        gameMap[gameKey].orders += 1

        // 玩法排行（只統計有 playKey 的）
        const pk = String(row.playKey ?? '').trim()
        if (pk) {
          if (!playMap[pk]) playMap[pk] = { sales: 0, orders: 0 }
          playMap[pk].sales += coin
          playMap[pk].orders += 1
        }
      }
    }
  }

  const totalSales = Object.values(dailyMap).reduce((a, b) => a + b, 0)
  const totalOrders = Object.values(gameMap).reduce((a, b) => a + b.orders, 0)
  const commission = Math.round(totalSales * 0.07)

  // 當月每日銷售（所有日期都要，無資料的補 0）
  const days = getDaysInMonth(month)
  const dailySales = days.map((day) => ({ day, sales: dailyMap[day] ?? 0 }))

  // 彩種排行
  const totalSalesForRatio = totalSales || 1
  const gameRanking = Object.entries(gameMap)
    .map(([key, v]) => ({
      key,
      name: GAME_NAMES[key] ?? key,
      sales: v.sales,
      orders: v.orders,
      ratio: Math.round((v.sales / totalSalesForRatio) * 10000) / 100,
    }))
    .sort((a, b) => b.sales - a.sales)

  // 玩法排行
  const totalPlaySales = Object.values(playMap).reduce((a, b) => a + b.sales, 0) || 1
  const playRanking = Object.entries(playMap)
    .map(([key, v]) => ({
      key,
      name: PLAY_NAMES[key] ?? key,
      sales: v.sales,
      orders: v.orders,
      ratio: Math.round((v.sales / totalPlaySales) * 10000) / 100,
    }))
    .sort((a, b) => b.sales - a.sales)

  // 台彩月排行
  const twTotalSales = Object.values(twGameMap).reduce((a, b) => a + b.sales, 0)
  const twTotalOrders = Object.values(twGameMap).reduce((a, b) => a + b.orders, 0)
  const twTotalSalesForRatio = twTotalSales || 1
  const twDailySales = days.map((day) => ({ day, sales: twDailyMap[day] ?? 0 }))
  // 補齊所有已註冊的台彩玩法（含本月尚無下注紀錄的），不是只列出有資料的
  const twGameRanking = Object.keys(TW_GAME_NAMES)
    .map((key) => {
      const v = twGameMap[key] ?? { sales: 0, orders: 0 }
      return {
        key,
        name: TW_GAME_NAMES[key] ?? key,
        sales: v.sales,
        orders: v.orders,
        ratio: Math.round((v.sales / twTotalSalesForRatio) * 10000) / 100,
      }
    })
    .sort((a, b) => b.sales - a.sales)

  return {
    month,
    totalSales,
    totalOrders,
    commission,
    dailySales,
    gameRanking,
    playRanking,
    twTotal: {
      totalSales: twTotalSales,
      totalOrders: twTotalOrders,
      dailySales: twDailySales,
      gameRanking: twGameRanking,
    },
    dataNote: '資料為 in-memory，伺服器重啟後清空。BG 彩票依 issue 日期篩選；台彩依下注時間（createdAt）篩選。',
  }
})
