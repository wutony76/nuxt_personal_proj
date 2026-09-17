import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'
import { P4_TIERS, P4_BET_AMOUNT, P4_DIGIT_COUNT, type P4TierKey } from '#shared/config/p4'

/**
 * 4星彩（P4）開發用測試工具：手動模擬開獎結算，不用等真實開獎日、也不打外部官方 API。
 *
 * ⚠️ 這支是**保留下來的開發測試工具**（管理員限定），比照 p3-test-settle.post.ts，
 * 供 scripts/test-p4.mjs 重複呼叫。正式環境部署前應評估是否要用環境變數關閉或整支移除。
 *
 * 在一個獨立的合成期別（預設 TEST-<timestamp>，可用 reuseIssue 指定固定值來測試「已結算
 * 期別不重複結算」）下建立測試注單並立刻結算，不會影響真實的 currentIssue／recordOpenCode 追蹤狀態。
 *
 * body: {
 *   bets: Array<{ betType: string; betCode: string }>   // 模擬 A~E 多組，各自一個下注方式＋4 位數字字串（例如 "1234"）
 *   winningNumbers: number[]                             // 4 個模擬開獎號（0~9，可重複）
 *   tiers?: Partial<Record<P4TierKey, number>>            // 該次模擬各官方獎項的 perPrize（不給的視為未中）
 *   reuseIssue?: string                                   // 指定要重用的合成期別，測「不重複結算」用
 * }
 */
type Body = {
  bets?: Array<{ betType?: string; betCode?: string }>
  winningNumbers?: number[]
  tiers?: Partial<Record<P4TierKey, number>>
  reuseIssue?: string
}

export default defineEventHandler(async (event) => {
  const login = sessionController.requireAdmin(event)
  const body = await readBody<Body>(event)

  const bets = Array.isArray(body?.bets) ? body.bets : []
  const winningNumbers = Array.isArray(body?.winningNumbers) ? body.winningNumbers.map(Number) : []
  if (bets.length === 0 || winningNumbers.length !== P4_DIGIT_COUNT) {
    throw createError({ statusCode: 400, message: `bets / winningNumbers(${P4_DIGIT_COUNT}) 為必填` })
  }

  const game = Storage.games[LOTTERY.P4.key] as any
  if (!game) throw createError({ statusCode: 503, message: 'P4 尚未初始化' })

  const testIssue = body?.reuseIssue || `TEST-${Date.now()}`
  // 「（測試）」後綴：確保這支工具寫進 recordOpenCode／注單紀錄的假資料，永遠能跟真實開獎紀錄分辨開來
  const testPeriod = `TESTPERIOD-${Date.now()}（測試）`
  const alreadySettledBefore = Boolean(game.issueSettledMap[testIssue])

  const orderIds = bets.map((bet) => {
    const betType = String(bet?.betType ?? '')
    const betCode = String(bet?.betCode ?? '')
    const orderId = game.handle.createOrderId(testIssue)
    game._get.orders().add.record({
      issue: testIssue,
      userId: login.id,
      coin: P4_BET_AMOUNT,
      orderId,
      betCode: [betCode],
      playKey: betType
    })
    game.handle.appendBetHistory({
      issue: testIssue,
      user_id: login.id,
      bet_time: Date.now(),
      coin: P4_BET_AMOUNT,
      order_id: orderId,
      bet_code: betCode,
      bet_type: betType
    })
    return orderId
  })

  const tiers = P4_TIERS.map((t) => ({
    label: t.label,
    winnerCount: Number(body?.tiers?.[t.key] ?? 0) > 0 ? 1 : 0,
    perPrize: Number(body?.tiers?.[t.key] ?? 0)
  }))

  game._settleIssue(testIssue, testPeriod, winningNumbers, tiers)

  const record = game.handle.ensureUserRecord(game._get.user(login.id))
  const settledRows = orderIds.map((orderId) => record.betHistory.find((row: any) => row.orderId === orderId))
  const claimable = record.claimableIssues.find((row: any) => String(row.issue) === testIssue)

  return {
    testIssue,
    testPeriod,
    alreadySettledBefore,
    settledRows,
    claimable: claimable ?? null,
    lastJackpotPrize: game.lastJackpotPrize,
    recordOpenCodeLength: game.recordOpenCode.length,
    recordOpenCodeTail: game.recordOpenCode[game.recordOpenCode.length - 1]
  }
})
