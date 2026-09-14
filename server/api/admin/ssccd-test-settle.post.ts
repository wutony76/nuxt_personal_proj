import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'

/**
 * 時時彩信用盤（SSC-CD）開發用測試工具：手動模擬開獎結算，不用等真實開獎週期。
 *
 * SSC-CD 的 settleIssuePrize 不碰共用彩池（SSC_SHARED.pool，那個只有 SSC-OF 的後三直選
 * 會寫），只會交件給共用的爆池層（SSC_JACKPOT，需要 CD 與 OF 都對同一期交件才會真的
 * 分配，見 sscSettleJackpotIfReady 的 guard）——跟 PK10-CD／K3-CD 的情況一致，
 * 這支工具不需要快照/還原彩池狀態。
 *
 * ⚠️ `settleIssuePrize` 本身沒有防重複呼叫的機制，防重複只在外層
 *   `settleClosedIssueIfNeeded()` 用 `issueSettledMap` 擋，這裡自己補一層一樣的 guard。
 *
 * odds 填 0：結算時 `judgeSscBet` 會用 `sscRtpOf(playKey, tabId)` 現場正確推算
 *   （讀真實分頁設定），跟真正下注時 `buildOrderRows` 鎖的值一致。
 *
 * body: {
 *   bets: Array<{ playKey: string; tabId: number; betCode: string; coin?: number }>
 *   openCode: Array<string|number>   // 5 個：0~9（可重複）
 *   reuseIssue?: string              // 指定要重用的合成期別，測「不重複結算」用
 * }
 */
type BetInput = { playKey?: string; tabId?: number; betCode?: string; coin?: number }
type Body = {
  bets?: BetInput[]
  openCode?: Array<string | number>
  reuseIssue?: string
}

export default defineEventHandler(async (event) => {
  const login = sessionController.requireAdmin(event)
  const body = await readBody<Body>(event)

  const bets = Array.isArray(body?.bets) ? body.bets : []
  const rawOpenCode = Array.isArray(body?.openCode) ? body.openCode : []
  const digits = rawOpenCode.map((code) => Number(code))
  const validOpenCode = digits.length === 5 && digits.every((n) => Number.isInteger(n) && n >= 0 && n <= 9)
  if (bets.length === 0 || !validOpenCode) {
    throw createError({ statusCode: 400, message: 'bets(至少1筆) / openCode(5個0~9的數字，可重複) 為必填' })
  }
  const openCode = digits.map(String)

  const game = Storage.games[LOTTERY['SSC-CD'].key] as any
  if (!game) throw createError({ statusCode: 503, message: 'SSC-CD 尚未初始化' })

  const testIssue = body?.reuseIssue || `TEST-SSCCD-${Date.now()}`
  const alreadySettledBefore = Boolean(game.issueSettledMap[testIssue])

  const orderIds = bets.map((bet) => {
    const playKey = String(bet?.playKey ?? '')
    const tabId = Number(bet?.tabId)
    const betCode = String(bet?.betCode ?? '')
    const coin = Number(bet?.coin ?? 100)
    const orderId = game.handle.createOrderId(testIssue)

    game._get.orders().add.record({
      issue: testIssue, userId: login.id, coin, orderId, tabId,
      betCode: [betCode], playKey, odds: 0
    })
    game.handle.appendBetHistory({
      issue: testIssue, user_id: login.id, select_tab_id: tabId, bet_time: Date.now(),
      coin, order_id: orderId, status: 'success', bet_code: [betCode],
      play_key: playKey, play_type_name: '', odds: 0
    })
    return orderId
  })

  if (!alreadySettledBefore) {
    game.handle.settleIssuePrize(testIssue, openCode)
    game.issueSettledMap[testIssue] = true
  }

  const record = game.handle.ensureUserRecord(game._get.user(login.id))
  const settledRows = orderIds.map((orderId) => record.betHistory.find((row: any) => row.orderId === orderId))
  const claimable = record.claimableIssues.find((row: any) => String(row.issue) === testIssue)

  return {
    testIssue,
    alreadySettledBefore,
    settledRows,
    claimable: claimable ?? null
  }
})
