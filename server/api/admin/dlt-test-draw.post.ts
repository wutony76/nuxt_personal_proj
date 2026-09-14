import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'
import type { DltTierKey } from '#shared/config/dlt'

/**
 * 大樂透（DLT）開發用測試工具：模擬「開獎＋結算」整條流程（保留下來，不刪），
 * 跟 `dlt-test-settle.post.ts`（只測「已知開獎號 → 派彩判定」這一段，直接呼叫
 * `_settleIssue`）不同——這支呼叫的是 `debugForceSettleNow()`，會實際跑過
 * `_attemptSettlement()` 整段邏輯：判斷官方期別是否已到位、依假資料結算目前
 * 真正 `currentIssue` 底下的所有注單、往下一個開獎日推進 `currentIssue`/`cutoffAt`/`drawAt`。
 *
 * 不用等真實開獎日、也不打外部官方 API（假資料取代），且不受目前 `currentStatus`
 * 是否為 pending-settlement 限制，隨時可呼叫。產生的 `recordOpenCode`／注單紀錄一律
 * 會被強制加上「（測試）」後綴（見 dlt.ts `_attemptSettlement`），不用手動清除。
 *
 * body: {
 *   winningNumbers: number[]                          // 6 個模擬開獎號
 *   special: number                                    // 模擬特別號
 *   tiers?: Partial<Record<DltTierKey, number>>         // 該次模擬各獎項的 perPrize（不給的視為未中）
 *   period?: string                                     // 模擬的官方期別（會自動補「（測試）」後綴）
 * }
 */
type Body = {
  winningNumbers?: number[]
  special?: number
  tiers?: Partial<Record<DltTierKey, number>>
  period?: string
}

export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)
  const body = await readBody<Body>(event)

  const winningNumbers = Array.isArray(body?.winningNumbers) ? body.winningNumbers.map(Number) : []
  const special = Number(body?.special)
  if (winningNumbers.length !== 6 || !Number.isFinite(special)) {
    throw createError({ statusCode: 400, message: 'winningNumbers(6) / special 為必填' })
  }

  const game = Storage.games[LOTTERY.DLT.key] as any
  if (!game) throw createError({ statusCode: 503, message: 'DLT 尚未初始化' })

  const issueBeforeSettlement = String(game.currentIssue)
  const statusBefore = String(game.currentStatus)
  const recordOpenCodeLengthBefore = game.recordOpenCode.length

  await game.debugForceSettleNow({
    period: body?.period || `TESTPERIOD-${Date.now()}`,
    lotNumber: [...winningNumbers, special],
    tiers: body?.tiers ?? {}
  })

  return {
    issueBeforeSettlement,
    statusBeforeSettlement: statusBefore,
    issueAfterSettlement: game.currentIssue,
    statusAfterSettlement: game.currentStatus,
    cutoffAtAfterSettlement: game.cutoffAt,
    drawAtAfterSettlement: game.drawAt,
    settledCount: game.recordOpenCode.length > recordOpenCodeLengthBefore
      ? 1
      : 0, // 這次呼叫是否實際新增了一筆 recordOpenCode（0 代表結算被 issueSettledMap 擋下）
    lastJackpotPrize: game.lastJackpotPrize,
    recordOpenCodeTail: game.recordOpenCode[game.recordOpenCode.length - 1]
  }
})
