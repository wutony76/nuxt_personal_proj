import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'
import { BINGO_DRAWN_COUNT } from '#shared/config/bingo'

/**
 * 賓果賓果（BINGO）開發用測試工具：模擬「開獎＋結算」整條流程（比照 p3-test-draw.post.ts）。
 * 呼叫 `debugForceSettleNow()`，會實際跑過 `_attemptSettlement()` 依假資料結算目前真正
 * `currentIssue` 底下的所有注單（4 種投注類型皆讀同一份假資料）。
 *
 * ⚠️ 只驗證「真實下注 → 依假開獎資料正確判定/派彩」這一段；`currentIssue`／`cutoffAt`／
 * `drawAt`／`lastKnownOfficialPeriod` 這些要拿來跟官方 API 對齊的真正期別追蹤狀態，測試呼叫
 * 一律不會去動（`_attemptSettlement()` 偵測到是測試模式就直接 return）。
 *
 * body: {
 *   winningNumbers: number[]   // 20 個模擬開獎號（01~80，依開球順序，第 20 個即超級獎號）
 *   lotBigSmall?: string       // '大'|'小'|'－'（和局），預設 '－'
 *   lotOddEven?: string        // '單'|'雙'|'－'（和局），預設 '－'
 *   period?: string            // 模擬的官方期別（會自動補「（測試）」後綴）
 * }
 */
type Body = {
  winningNumbers?: number[]
  lotBigSmall?: string
  lotOddEven?: string
  period?: string
}

export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)
  const body = await readBody<Body>(event)

  const winningNumbers = Array.isArray(body?.winningNumbers) ? body.winningNumbers.map(Number) : []
  if (winningNumbers.length !== BINGO_DRAWN_COUNT) {
    throw createError({ statusCode: 400, message: `winningNumbers(${BINGO_DRAWN_COUNT}) 為必填` })
  }

  const game = Storage.games[LOTTERY.BINGO.key] as any
  if (!game) throw createError({ statusCode: 503, message: 'BINGO 尚未初始化' })

  const issueBeforeSettlement = String(game.currentIssue)
  const statusBefore = String(game.currentStatus)
  const recordOpenCodeLengthBefore = game.recordOpenCode.length

  await game.debugForceSettleNow({
    period: body?.period || `TESTPERIOD-${Date.now()}`,
    lotNumber: [...winningNumbers],
    lotBigSmall: body?.lotBigSmall ?? '－',
    lotOddEven: body?.lotOddEven ?? '－'
  })

  return {
    issueBeforeSettlement,
    statusBeforeSettlement: statusBefore,
    issueAfterSettlement: game.currentIssue,
    statusAfterSettlement: game.currentStatus,
    cutoffAtAfterSettlement: game.cutoffAt,
    drawAtAfterSettlement: game.drawAt,
    settledCount: game.recordOpenCode.length > recordOpenCodeLengthBefore ? 1 : 0,
    recordOpenCodeTail: game.recordOpenCode[game.recordOpenCode.length - 1]
  }
})
