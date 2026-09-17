import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'
import { P3_DIGIT_COUNT, type P3TierKey } from '#shared/config/p3'

/**
 * 3星彩（P3）開發用測試工具：模擬「開獎＋結算」整條流程（保留下來，不刪），
 * 跟 `p3-test-settle.post.ts`（只測「已知開獎號 → 派彩判定」這一段，直接呼叫 `_settleIssue`）
 * 不同——這支呼叫的是 `debugForceSettleNow()`，會實際跑過 `_attemptSettlement()` 依假資料結算
 * 目前真正 `currentIssue` 底下的所有注單（比照 m649-test-draw.post.ts／d539-test-draw.post.ts）。
 *
 * ⚠️ 只驗證「真實下注 → 依假開獎號正確判定/派彩」這一段；`currentIssue`／`cutoffAt`／`drawAt`／
 * `lastKnownOfficialPeriod` 這些要拿來跟官方 API 對齊的真正期別追蹤狀態，測試呼叫一律不會去動
 * （`_attemptSettlement()` 偵測到是測試模式就直接 return，不會走到期別推進那段）。
 * 所以下面回傳的 `issueAfterSettlement` 理論上永遠等於 `issueBeforeSettlement`。
 *
 * body: {
 *   winningNumbers: number[]                          // 3 個模擬開獎號（0~9，可重複）
 *   tiers?: Partial<Record<P3TierKey, number>>          // 該次模擬各官方獎項的 perPrize（不給的視為未中）
 *   period?: string                                     // 模擬的官方期別（會自動補「（測試）」後綴）
 * }
 */
type Body = {
  winningNumbers?: number[]
  tiers?: Partial<Record<P3TierKey, number>>
  period?: string
}

export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)
  const body = await readBody<Body>(event)

  const winningNumbers = Array.isArray(body?.winningNumbers) ? body.winningNumbers.map(Number) : []
  if (winningNumbers.length !== P3_DIGIT_COUNT) {
    throw createError({ statusCode: 400, message: `winningNumbers(${P3_DIGIT_COUNT}) 為必填` })
  }

  const game = Storage.games[LOTTERY.P3.key] as any
  if (!game) throw createError({ statusCode: 503, message: 'P3 尚未初始化' })

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
