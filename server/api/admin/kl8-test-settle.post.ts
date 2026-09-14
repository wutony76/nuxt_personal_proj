import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'
import { KL8_POOL_PLAY_KEY } from '#shared/config/kl8-cd'

/**
 * 快樂8（KL8）開發用測試工具：手動模擬開獎結算，不用等真實開獎週期。
 *
 * ⚠️⚠️ 跟 EGGS／KL10 完全同構的坑：KL8 只有信用盤一個盤口，全站只有一個 instance
 *   （`Storage.games['KL8']`），玩家看到的彩池／爆池滾存就是這個 instance 的
 *   `carryPool`／`carryJackpot` 兩個欄位。`settleIssuePrize()` 尾端會**無條件**寫入
 *   這兩個欄位，不管這次結算有沒有相關注單、有沒有真的觸發爆池都會執行——
 *   沒有 CD/OF 成對盤口那種「等雙方交件才真的分配」的天然緩衝。所以這裡對
 *   `carryPool`／`carryJackpot`／`lastJackpotHit` 都要「呼叫前快照、呼叫後同步還原」。
 *
 * ⚠️ `settleIssuePrize` 本身也沒有防重複呼叫的機制，防重複只在外層
 *   `settleClosedIssueIfNeeded()` 用 `issueSettledMap` 擋，這裡自己補一層一樣的 guard。
 *
 * odds 填 0：結算時 `judgeKl8Bet` 會用 `kl8RtpOf(playKey, tabId)` 現場正確推算
 *   （讀真實分頁設定），跟真正下注時 `buildOrderRows` 鎖的值一致。
 *
 * body: {
 *   bets?: Array<{ playKey: string; tabId: number; betCode: string; coin?: number }>  // 任選/兩面
 *   poolBets?: Array<{ picks: number[]; coin?: number }>                               // xuanhao 選號（彩池，3碼）
 *   openCode: Array<string|number>   // 20 個：1~80 且互不重複
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
  const nums = rawOpenCode.map((code) => Number(code))
  const validOpenCode = nums.length === 20
    && nums.every((n) => Number.isInteger(n) && n >= 1 && n <= 80)
    && new Set(nums).size === 20
  if ((bets.length === 0 && poolBets.length === 0) || !validOpenCode) {
    throw createError({ statusCode: 400, message: 'bets/poolBets 至少一項要有內容，openCode 需為 20 個 1~80 且互不重複的數字' })
  }
  const openCode = nums.map((n) => String(n).padStart(2, '0'))

  const game = Storage.games[LOTTERY.KL8.key] as any
  if (!game) throw createError({ statusCode: 503, message: 'KL8 尚未初始化' })

  const testIssue = body?.reuseIssue || `TEST-KL8-${Date.now()}`
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
    const validPicks = picks.length === 3 && picks.every((n) => Number.isInteger(n) && n >= 1 && n <= 80) && new Set(picks).size === 3
    if (!validPicks) {
      throw createError({ statusCode: 400, message: '選號玩法每注需 3 個 1~80 且互不重複的數字' })
    }
    const coin = Number(bet?.coin ?? 100)
    const orderId = game.handle.createOrderId(testIssue)

    game._get.orders().add.record({
      issue: testIssue, userId: login.id, coin, orderId, tabId: 0,
      betCode: picks.map(String), playKey: KL8_POOL_PLAY_KEY, odds: 0
    })
    game.handle.appendBetHistory({
      issue: testIssue, user_id: login.id, select_tab_id: 0, bet_time: Date.now(),
      coin, order_id: orderId, status: 'success', bet_code: picks.map(String),
      play_key: KL8_POOL_PLAY_KEY, play_type_name: '選號', odds: 0
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
