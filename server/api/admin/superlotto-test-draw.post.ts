import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'
import type { SuperlottoTierKey } from '#shared/config/superlotto'

/**
 * 威力彩（SUPERLOTTO）開發用測試工具：模擬「開獎＋結算」整條流程（保留下來，不刪），
 * 跟 `superlotto-test-settle.post.ts`（只測「已知開獎號 → 派彩判定」這一段，直接呼叫
 * `_settleIssue`）不同——這支呼叫的是 `debugForceSettleNow()`，會實際跑過 `_attemptSettlement()`
 * 依假資料結算目前真正 `currentIssue` 底下的所有注單。
 *
 * ⚠️ 只驗證「真實下注 → 依假開獎號正確判定/派彩」這一段；`currentIssue`／`cutoffAt`／`drawAt`／
 * `lastKnownOfficialPeriod` 這些要拿來跟官方 API 對齊的真正期別追蹤狀態，測試呼叫一律不會去動
 * （`_attemptSettlement()` 偵測到是測試模式就直接 return，不會走到期別推進那段）——避免反覆呼叫
 * 這支工具讓站上顯示的期號悄悄跟官方真實序號脫鉤（且無法回復，只能重啟 server）。
 * 所以下面回傳的 `issueAfterSettlement` 理論上永遠等於 `issueBeforeSettlement`。
 *
 * body: {
 *   winningZoneA: number[]                              // 第一區 6 個模擬開獎號
 *   winningZoneB: number                                // 第二區 1 個模擬開獎號
 *   tiers?: Partial<Record<SuperlottoTierKey, number>>   // 該次模擬各獎項的 perPrize（不給的視為未中）
 *   period?: string                                      // 模擬的官方期別（會自動補「（測試）」後綴）
 * }
 */
type Body = {
  winningZoneA?: number[]
  winningZoneB?: number
  tiers?: Partial<Record<SuperlottoTierKey, number>>
  period?: string
}

export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)
  const body = await readBody<Body>(event)

  const winningZoneA = Array.isArray(body?.winningZoneA) ? body.winningZoneA.map(Number) : []
  const winningZoneB = Number(body?.winningZoneB)
  if (winningZoneA.length !== 6 || !Number.isFinite(winningZoneB)) {
    throw createError({ statusCode: 400, message: 'winningZoneA(6) / winningZoneB 為必填' })
  }

  const game = Storage.games[LOTTERY.SUPERLOTTO.key] as any
  if (!game) throw createError({ statusCode: 503, message: 'SUPERLOTTO 尚未初始化' })

  const issueBeforeSettlement = String(game.currentIssue)
  const statusBefore = String(game.currentStatus)
  const recordOpenCodeLengthBefore = game.recordOpenCode.length

  await game.debugForceSettleNow({
    period: body?.period || `TESTPERIOD-${Date.now()}`,
    lotNumber: [...winningZoneA, winningZoneB],
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
