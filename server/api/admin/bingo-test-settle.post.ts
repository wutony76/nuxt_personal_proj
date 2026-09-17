import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'
import { BINGO_BET_UNIT, BINGO_DRAWN_COUNT, bingoEncodeSlot, type BingoSlot } from '#shared/config/bingo'

/**
 * 賓果賓果（BINGO）開發用測試工具：手動模擬開獎結算，不用等真實開獎、也不打外部官方 API
 * （比照 p3-test-settle.post.ts）。
 *
 * 在一個獨立的合成期別（預設 TEST-<timestamp>，可用 reuseIssue 指定固定值來測試「已結算期別
 * 不重複結算」）下建立測試注單並立刻結算，不會影響真實的 currentIssue／recordOpenCode 追蹤狀態。
 *
 * body: {
 *   bets: BingoSlot[]                 // 模擬多組，各自一種投注類型（star/super/bigSmall/oddEven）
 *   winningNumbers: number[]          // 20 個模擬開獎號（01~80，依開球順序，第 20 個即超級獎號）
 *   lotBigSmall?: string              // 預設 '－'
 *   lotOddEven?: string               // 預設 '－'
 *   reuseIssue?: string               // 指定要重用的合成期別，測「不重複結算」用
 * }
 */
type Body = {
  bets?: BingoSlot[]
  winningNumbers?: number[]
  lotBigSmall?: string
  lotOddEven?: string
  reuseIssue?: string
}

export default defineEventHandler(async (event) => {
  const login = sessionController.requireAdmin(event)
  const body = await readBody<Body>(event)

  const bets = Array.isArray(body?.bets) ? body.bets : []
  const winningNumbers = Array.isArray(body?.winningNumbers) ? body.winningNumbers.map(Number) : []
  if (bets.length === 0 || winningNumbers.length !== BINGO_DRAWN_COUNT) {
    throw createError({ statusCode: 400, message: `bets / winningNumbers(${BINGO_DRAWN_COUNT}) 為必填` })
  }

  const game = Storage.games[LOTTERY.BINGO.key] as any
  if (!game) throw createError({ statusCode: 503, message: 'BINGO 尚未初始化' })

  const testIssue = body?.reuseIssue || `TEST-${Date.now()}`
  const testPeriod = `TESTPERIOD-${Date.now()}（測試）`
  const alreadySettledBefore = Boolean(game.issueSettledMap[testIssue])

  const orderIds = bets.map((bet) => {
    const orderId = game.handle.createOrderId(testIssue)
    const code = bingoEncodeSlot(bet)
    game._get.orders().add.record({
      issue: testIssue,
      userId: login.id,
      coin: BINGO_BET_UNIT,
      orderId,
      betCode: [code],
      playKey: bet.betType
    })
    game.handle.appendBetHistory({
      issue: testIssue,
      user_id: login.id,
      bet_time: Date.now(),
      coin: BINGO_BET_UNIT,
      order_id: orderId,
      bet_code: code,
      bet_type: bet.betType
    })
    return orderId
  })

  const numbers = winningNumbers.slice(0, BINGO_DRAWN_COUNT).map((n, idx) => ({ number: n, order: idx + 1 }))
  const draw = {
    issue: testPeriod,
    numbers,
    lotBigSmall: body?.lotBigSmall ?? '－',
    lotOddEven: body?.lotOddEven ?? '－'
  }

  game._settleIssue(testIssue, testPeriod, draw)

  const record = game.handle.ensureUserRecord(game._get.user(login.id))
  const settledRows = orderIds.map((orderId) => record.betHistory.find((row: any) => row.orderId === orderId))
  const claimable = record.claimableIssues.find((row: any) => String(row.issue) === testIssue)

  return {
    testIssue,
    testPeriod,
    alreadySettledBefore,
    settledRows,
    claimable: claimable ?? null,
    recordOpenCodeLength: game.recordOpenCode.length,
    recordOpenCodeTail: game.recordOpenCode[game.recordOpenCode.length - 1]
  }
})
