import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'

/**
 * PK10 信用盤（PK10-CD）開發用測試工具：手動模擬開獎結算，不用等真實開獎週期。
 *
 * PK10-CD 的 settleIssuePrize 不碰共用彩池（PK10_SHARED.pool，那個只有 PK10-OF 的前三直選
 * 會寫），只會交件給共用的爆池層（PK10_JACKPOT，需要 CD 與 OF 都對同一期交件才會真的
 * 分配，見 pk10SettleJackpotIfReady 的 guard）——所以這支工具不需要像 pk10of-test-settle
 * 那樣快照／還原彩池狀態，跟 K3-CD 的情況相同。
 *
 * ⚠️ `settleIssuePrize` 本身沒有防重複呼叫的機制（跟 K3-CD 同構），防重複只在外層
 *   `settleClosedIssueIfNeeded()` 用 `issueSettledMap` 擋，這裡自己補一層一樣的 guard。
 *
 * odds 填 0：結算時 `judgePk10Bet` 會用 `pk10RtpOf(playKey, tabId)` 現場正確推算
 *   （讀真實分頁設定，不是猜的 fallback），跟真正下注時 `buildOrderRows` 鎖的值一致。
 *
 * body: {
 *   bets: Array<{ playKey: string; tabId: number; betCode: string; coin?: number }>
 *   openCode: string[]|number[]   // 10 個：1~10 的排列（第 i 個 = 第 i+1 名的車號）
 *   reuseIssue?: string           // 指定要重用的合成期別，測「不重複結算」用
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
  const openCode = rawOpenCode.map((code) => String(Number(code)).padStart(2, '0'))
  const cars = openCode.map((code) => Number(code))
  const validOpenCode = cars.length === 10 && cars.every((n) => n >= 1 && n <= 10) && new Set(cars).size === 10
  if (bets.length === 0 || !validOpenCode) {
    throw createError({ statusCode: 400, message: 'bets(至少1筆) / openCode(1~10 的排列，10個) 為必填' })
  }

  const game = Storage.games[LOTTERY['PK10-CD'].key] as any
  if (!game) throw createError({ statusCode: 503, message: 'PK10-CD 尚未初始化' })

  const testIssue = body?.reuseIssue || `TEST-PK10CD-${Date.now()}`
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
