import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'
import { EGGS_POOL_PLAY_KEY } from '#shared/config/eggs-cd'

/**
 * PC蛋蛋（EGGS）開發用測試工具：手動模擬開獎結算，不用等真實開獎週期。
 *
 * ⚠️⚠️ 跟其他彩種的「共用彩池」坑同構、但風險更集中：EGGS 只有一個盤口（沒有 CD/OF
 *   之分），`Storage.games['EGGS']` 全站只有這一個 instance，玩家看到的彩池／爆池
 *   滾存就是這個 instance 的 `carryPool`／`carryJackpot` 兩個欄位。`settleIssuePrize()`
 *   尾端會**無條件**寫入 `this.carryPool = carryPoolNext`（`eggs.ts:543`）與
 *   `this.carryJackpot = jackpot.remain`（`eggs.ts:570`），不管這次結算有沒有相關注單、
 *   也不管開獎是不是真的觸發爆池都會執行——而且不像 K3/PK10/SSC/X5 的 OF 那樣有
 *   「等其他盤口交件才真的分配」的緩衝，EGGS 是單一 instance、單次呼叫就直接算完寫入，
 *   完全沒有天然防護。所以這裡對 `carryPool`／`carryJackpot`／`lastJackpotHit`
 *   三者都要「呼叫前快照、呼叫後同步還原」，比其他彩種的測試工具還更不能省略。
 *
 * ⚠️ `settleIssuePrize` 本身也沒有防重複呼叫的機制，防重複只在外層
 *   `settleClosedIssueIfNeeded()` 用 `issueSettledMap` 擋，這裡自己補一層一樣的 guard。
 *
 * odds 填 0：結算時 `judgeEggsBet` 會用 `eggsRtpOf(playKey, tabId)` 現場正確推算
 *   （讀真實分頁設定），跟真正下注時 `buildOrderRows` 鎖的值一致。
 *
 * body: {
 *   bets?: Array<{ playKey: string; tabId: number; betCode: string; coin?: number }>  // 固定賠率 5 玩法
 *   poolBets?: Array<{ picks: number[]; coin?: number }>                               // xuanhao 選號（彩池）
 *   openCode: Array<string|number>   // 3 個：0~9（可重複）
 *   reuseIssue?: string              // 指定要重用的合成期別，測「不重複結算」用
 * }
 */
type BetInput = { playKey?: string; tabId?: number; betCode?: string; coin?: number }
type PoolBetInput = { picks?: number[]; coin?: number }
type Body = {
  bets?: BetInput[]
  poolBets?: PoolBetInput[]
  openCode?: Array<string | number>
  reuseIssue?: string
}

export default defineEventHandler(async (event) => {
  const login = sessionController.requireAdmin(event)
  const body = await readBody<Body>(event)

  const bets = Array.isArray(body?.bets) ? body.bets : []
  const poolBets = Array.isArray(body?.poolBets) ? body.poolBets : []
  const rawOpenCode = Array.isArray(body?.openCode) ? body.openCode : []
  const digits = rawOpenCode.map((code) => Number(code))
  const validOpenCode = digits.length === 3 && digits.every((n) => Number.isInteger(n) && n >= 0 && n <= 9)
  if ((bets.length === 0 && poolBets.length === 0) || !validOpenCode) {
    throw createError({ statusCode: 400, message: 'bets/poolBets 至少一項要有內容，openCode(3個0~9的數字，可重複) 為必填' })
  }
  const openCode = digits.map(String)

  const game = Storage.games[LOTTERY.EGGS.key] as any
  if (!game) throw createError({ statusCode: 503, message: 'EGGS 尚未初始化' })

  const testIssue = body?.reuseIssue || `TEST-EGGS-${Date.now()}`
  const alreadySettledBefore = Boolean(game.issueSettledMap[testIssue])

  const orderIds: string[] = []
  bets.forEach((bet) => {
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
    orderIds.push(orderId)
  })

  poolBets.forEach((bet) => {
    const picks = Array.isArray(bet?.picks) ? bet.picks.map(Number) : []
    if (picks.length !== 3 || picks.some((n) => !Number.isInteger(n) || n < 0 || n > 9)) {
      throw createError({ statusCode: 400, message: '選號玩法每注需 3 個 0~9 的數字（可重複）' })
    }
    const coin = Number(bet?.coin ?? 100)
    const orderId = game.handle.createOrderId(testIssue)

    game._get.orders().add.record({
      issue: testIssue, userId: login.id, coin, orderId, tabId: 0,
      betCode: picks.map(String), playKey: EGGS_POOL_PLAY_KEY, odds: 0
    })
    game.handle.appendBetHistory({
      issue: testIssue, user_id: login.id, select_tab_id: 0, bet_time: Date.now(),
      coin, order_id: orderId, status: 'success', bet_code: picks.map(String),
      play_key: EGGS_POOL_PLAY_KEY, play_type_name: '選號', odds: 0
    })
    orderIds.push(orderId)
  })

  // ⚠️ 全站唯一 instance 的彩池／爆池快照與還原：settleIssuePrize 全程同步、中間沒有 await，
  //    自動結算的 300ms tick 不可能插進這段 try/finally，還原一定完整生效
  const carryPoolBefore = Number(game.carryPool ?? 0)
  const carryJackpotBefore = Number(game.carryJackpot ?? 0)
  const lastJackpotHitBefore = game.lastJackpotHit ?? null
  let carryPoolImmediatelyAfterSettle = carryPoolBefore
  let carryJackpotImmediatelyAfterSettle = carryJackpotBefore
  try {
    if (!alreadySettledBefore) {
      game.handle.settleIssuePrize(testIssue, openCode)
      game.issueSettledMap[testIssue] = true
      carryPoolImmediatelyAfterSettle = Number(game.carryPool ?? 0)
      carryJackpotImmediatelyAfterSettle = Number(game.carryJackpot ?? 0)
    }
  } finally {
    game.carryPool = carryPoolBefore
    game.carryJackpot = carryJackpotBefore
    game.lastJackpotHit = lastJackpotHitBefore
    delete game.issuePoolMap[testIssue]
    delete game.issueJackpotMap[testIssue]
  }

  const record = game.handle.ensureUserRecord(game._get.user(login.id))
  const settledRows = orderIds.map((orderId) => record.betHistory.find((row: any) => row.orderId === orderId))
  const claimable = record.claimableIssues.find((row: any) => String(row.issue) === testIssue)

  return {
    testIssue,
    alreadySettledBefore,
    settledRows,
    claimable: claimable ?? null,
    carryPool: {
      before: carryPoolBefore,
      wouldHaveChangedToWithoutGuard: carryPoolImmediatelyAfterSettle,
      restoredTo: Number(game.carryPool ?? 0)
    },
    carryJackpot: {
      before: carryJackpotBefore,
      wouldHaveChangedToWithoutGuard: carryJackpotImmediatelyAfterSettle,
      restoredTo: Number(game.carryJackpot ?? 0)
    }
  }
})
