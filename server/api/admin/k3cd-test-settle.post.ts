import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'

/**
 * 快3信用盤（K3-CD）開發用測試工具：手動模擬開獎結算，不用等真實開獎週期（K3-CD 每期約數分鐘）。
 *
 * ⚠️⚠️ 關鍵差異（跟 DLT 的 dlt-test-settle 不同）：K3-CD 的 `settleIssuePrize(issue, openCode)`
 * **本身沒有防重複呼叫的機制**——防重複是擋在外層的 `settleClosedIssueIfNeeded()`（逐期迴圈裡先查
 * `issueSettledMap`、呼叫完才設定 `true`），`settleIssuePrize` 直接呼叫兩次會導致
 * `claimableIssues.amount` 被重複疊加（真的會重複派彩，不是誤解）。這支測試路由因此**自己在外層
 * 補一層跟 `settleClosedIssueIfNeeded` 完全一樣的 guard**，不能省略。
 *
 * 用獨立的合成期別（`TEST-K3CD-<timestamp>`，可用 reuseIssue 指定固定值來測試冪等性）建立測試注單
 * 並立刻結算，不會影響真實的 `recordOpenCode`／`currentIndex` 追蹤狀態，也不會跟正式的
 * `circle()` → `settleClosedIssueIfNeeded()` 自動結算互相干擾（合成期別不存在於 `recordOpenCode`，
 * 正式流程永遍不會走到它）。
 *
 * body: {
 *   bets: Array<{ playKey: 'sanjun'|'weitou'|'changduan'; tabId: number; betCode: string; coin?: number }>
 *   openCode: number[]                 // 3 顆骰子，1~6
 *   reuseIssue?: string                // 指定要重用的合成期別，測「不重複結算」用
 * }
 */
type BetInput = { playKey?: string; tabId?: number; betCode?: string; coin?: number }
type Body = {
  bets?: BetInput[]
  openCode?: number[]
  reuseIssue?: string
}

export default defineEventHandler(async (event) => {
  const login = sessionController.requireAdmin(event)
  const body = await readBody<Body>(event)

  const bets = Array.isArray(body?.bets) ? body.bets : []
  const openCode = Array.isArray(body?.openCode) ? body.openCode.map(Number) : []
  if (bets.length === 0 || openCode.length !== 3 || openCode.some((n) => !(n >= 1 && n <= 6))) {
    throw createError({ statusCode: 400, message: 'bets(至少1筆) / openCode(3個1~6的數字) 為必填' })
  }

  const game = Storage.games[LOTTERY['K3-CD'].key] as any
  if (!game) throw createError({ statusCode: 503, message: 'K3-CD 尚未初始化' })

  const testIssue = body?.reuseIssue || `TEST-K3CD-${Date.now()}`
  const alreadySettledBefore = Boolean(game.issueSettledMap[testIssue])

  const orderIds = bets.map((bet) => {
    const playKey = String(bet?.playKey ?? '')
    const tabId = Number(bet?.tabId)
    const betCode = String(bet?.betCode ?? '')
    const coin = Number(bet?.coin ?? 100)
    const orderId = game.handle.createOrderId(testIssue)

    game._get.orders().add.record({
      issue: testIssue,
      userId: login.id,
      coin,
      orderId,
      tabId,
      betCode: [betCode],
      playKey,
      odds: 0 // 不鎖賠率，settleIssuePrize 判定時 odds<=0 會用 rtp 現場推算（比照真實 buildOrderRows 的行為）
    })
    game.handle.appendBetHistory({
      issue: testIssue,
      user_id: login.id,
      select_tab_id: tabId,
      bet_time: Date.now(),
      coin,
      order_id: orderId,
      status: 'success',
      bet_code: [betCode],
      play_key: playKey,
      play_type_name: '',
      odds: 0
    })
    return orderId
  })

  // ⚠️ 比照 settleClosedIssueIfNeeded 的 guard：settleIssuePrize 本身不防重複，這裡一定要自己擋
  if (!alreadySettledBefore) {
    game.handle.settleIssuePrize(testIssue, openCode.map(String))
    game.issueSettledMap[testIssue] = true
  }

  const record = game.handle.ensureUserRecord(game._get.user(login.id))
  const settledRows = orderIds.map((orderId) => record.betHistory.find((row: any) => row.orderId === orderId))
  const claimable = record.claimableIssues.find((row: any) => String(row.issue) === testIssue)

  return {
    testIssue,
    alreadySettledBefore,
    settledRows,
    claimable: claimable ?? null,
    jackpotLastHit: game.get?.creditJackpot?.()?.lastHit ?? null
  }
})
