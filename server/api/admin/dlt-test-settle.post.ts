import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'
import { DLT_TIERS, type DltTierKey } from '#shared/config/dlt'

/**
 * 大樂透（DLT）開發用測試工具：手動模擬開獎結算，不用等真實開獎日、也不打外部官方 API。
 *
 * ⚠️ 這支是**保留下來的開發測試工具**（管理員限定），跟 add-dlt 實作期間那支「用完即刪」的
 * 臨時探測路由不同——使用者要求要能「隨時測試」，所以這支不刪，供 test/test-dlt.mjs
 * 重複呼叫。正式環境部署前應評估是否要用環境變數關閉或整支移除。
 *
 * 在一個獨立的合成期別（預設 TEST-<timestamp>，可用 reuseIssue 指定固定值來測試「已結算
 * 期別不重複結算」）下建立測試注單並立刻結算，不會影響真實的 currentIssue／recordOpenCode
 * 追蹤狀態，也不會跟未來真實的自動結算流程互相干擾。
 *
 * body: {
 *   betCodes: string[]                              // 模擬 A~E 多組，各自一個 "01,02,03,04,05,06" 字串
 *   winningNumbers: number[]                         // 6 個模擬開獎號
 *   special: number                                  // 模擬特別號
 *   tiers?: Partial<Record<DltTierKey, number>>       // 該次模擬各獎項的 perPrize（不給的視為未中）
 *   reuseIssue?: string                               // 指定要重用的合成期別，測「不重複結算」用
 * }
 */
type Body = {
  betCode?: string
  betCodes?: string[]
  winningNumbers?: number[]
  special?: number
  tiers?: Partial<Record<DltTierKey, number>>
  reuseIssue?: string
}

export default defineEventHandler(async (event) => {
  const login = sessionController.requireAdmin(event)
  const body = await readBody<Body>(event)

  const betCodes = Array.isArray(body?.betCodes) && body.betCodes.length > 0
    ? body.betCodes.map(String)
    : (body?.betCode ? [String(body.betCode)] : [])
  const winningNumbers = Array.isArray(body?.winningNumbers) ? body.winningNumbers.map(Number) : []
  const special = Number(body?.special)
  if (betCodes.length === 0 || winningNumbers.length !== 6 || !Number.isFinite(special)) {
    throw createError({ statusCode: 400, message: 'betCode(s) / winningNumbers(6) / special 為必填' })
  }

  const game = Storage.games[LOTTERY.DLT.key] as any
  if (!game) throw createError({ statusCode: 503, message: 'DLT 尚未初始化' })

  const testIssue = body?.reuseIssue || `TEST-${Date.now()}`
  // 「（測試）」後綴：確保這支工具寫進 recordOpenCode／注單紀錄的假資料，
  // 永遠能跟真實開獎紀錄一眼分辨開來（使用者要求，紀錄本身不用清除）
  const testPeriod = `TESTPERIOD-${Date.now()}（測試）`
  const alreadySettledBefore = Boolean(game.issueSettledMap[testIssue])

  const orderIds = betCodes.map((betCode) => {
    const orderId = game.handle.createOrderId(testIssue)
    game._get.orders().add.record({
      issue: testIssue,
      userId: login.id,
      coin: 50,
      orderId,
      betCode: [betCode]
    })
    game.handle.appendBetHistory({
      issue: testIssue,
      user_id: login.id,
      bet_time: Date.now(),
      coin: 50,
      order_id: orderId,
      bet_code: betCode
    })
    return orderId
  })

  const tiers = DLT_TIERS.map((t) => ({
    label: t.label,
    winnerCount: Number(body?.tiers?.[t.key] ?? 0) > 0 ? 1 : 0,
    perPrize: Number(body?.tiers?.[t.key] ?? 0)
  }))

  game._settleIssue(testIssue, testPeriod, winningNumbers, special, tiers)

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
