import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'
import { M649_DRAW_COUNT, type M649TierKey } from '#shared/config/m649'

/**
 * 49樂合彩（M649）開發用測試工具：模擬「開獎＋結算」整條流程（保留下來，不刪），
 * 跟 `m649-test-settle.post.ts`（只測「已知開獎號 → 派彩判定」這一段，直接呼叫 `_settleIssue`）
 * 不同——這支呼叫的是 `debugForceSettleNow()`，會實際跑過 `_attemptSettlement()` 依假資料結算
 * 目前真正 `currentIssue` 底下的所有注單（比照 dlt-test-draw.post.ts／d539-test-draw.post.ts）。
 *
 * ⚠️ 只驗證「真實下注 → 依假開獎號正確判定/派彩」這一段；`currentIssue`／`cutoffAt`／`drawAt`／
 * `lastKnownOfficialPeriod` 這些要拿來跟官方 API 對齊的真正期別追蹤狀態，測試呼叫一律不會去動
 * （`_attemptSettlement()` 偵測到是測試模式就直接 return，不會走到期別推進那段）。
 * 所以下面回傳的 `issueAfterSettlement` 理論上永遠等於 `issueBeforeSettlement`。
 *
 * body: {
 *   winningNumbers: number[]                          // 6 個模擬開獎號（49樂合彩＝大樂透 6 個主號、無特別號）
 *   tiers?: Partial<Record<M649TierKey, number>>        // 該次模擬各合數的 perPrize（不給的視為未中）
 *   period?: string                                     // 模擬的官方期別（會自動補「（測試）」後綴）
 * }
 */
type Body = {
  winningNumbers?: number[]
  tiers?: Partial<Record<M649TierKey, number>>
  period?: string
}

export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)
  const body = await readBody<Body>(event)

  const winningNumbers = Array.isArray(body?.winningNumbers) ? body.winningNumbers.map(Number) : []
  if (winningNumbers.length !== M649_DRAW_COUNT) {
    throw createError({ statusCode: 400, message: `winningNumbers(${M649_DRAW_COUNT}) 為必填` })
  }

  const game = Storage.games[LOTTERY.M649.key] as any
  if (!game) throw createError({ statusCode: 503, message: 'M649 尚未初始化' })

  const issueBeforeSettlement = String(game.currentIssue)
  const statusBefore = String(game.currentStatus)
  const recordOpenCodeLengthBefore = game.recordOpenCode.length

  await game.debugForceSettleNow({
    period: body?.period || `TESTPERIOD-${Date.now()}`,
    lotNumber: [...winningNumbers],
    tiers: body?.tiers ?? {}
  })

  return {
    issueBeforeSettlement,
    statusBeforeSettlement: statusBefore,
    issueAfterSettlement: game.currentIssue,
    statusAfterSettlement: game.currentStatus,
    cutoffAtAfterSettlement: game.cutoffAt,
    drawAtAfterSettlement: game.drawAt,
    settledCount: game.recordOpenCode.length > recordOpenCodeLengthBefore ? 1 : 0,
    lastJackpotPrize: game.lastJackpotPrize,
    recordOpenCodeTail: game.recordOpenCode[game.recordOpenCode.length - 1]
  }
})
