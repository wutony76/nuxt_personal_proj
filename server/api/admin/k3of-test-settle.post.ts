import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'
import { k3OfTabOddsOf } from '#shared/config/k3of/helpers'
import { k3OfPicksOf, K3_OF_POOL_PLAY_KEY } from '#shared/config/k3-of'
import { K3_SHARED, K3_JACKPOT } from '../../services/game/lottery/bg/k3Shared'

/**
 * 快3官方盤（K3-OF）開發用測試工具：手動模擬開獎結算，不用等真實開獎週期。
 *
 * ⚠️⚠️ 比 K3-CD 多一層風險：K3-OF 的 `settleIssuePrize()` 尾端會**無條件**執行
 *   `K3_SHARED.pool.carry = carryNext`（彩池滾存），不管這次結算有沒有人下彩池玩法
 *   （xuanhao）——只要呼叫 settleIssuePrize，就一定會把「這次合成測試期的滾存計算結果」
 *   蓋掉「正式彩池的真實 carry」，直接影響 K3-CD／K3-OF 兩邊玩家真正看到的彩池與派彩。
 *   這裡的作法是：呼叫前先存一份 `K3_SHARED.pool.carry` 快照，呼叫完立刻（同一個
 *   synchronous 呼叫鏈內，中間沒有 await，不會被 300ms 一次的自動結算 tick 插進來）
 *   還原回去，讓正式彩池狀態完全不受測試影響。同時清掉這次測試合成期別在
 *   `K3_SHARED.pool.issueMap` 與 `K3_JACKPOT.pending` 留下的殘留 key，避免無限增長。
 *
 * ⚠️ 爆池（K3_JACKPOT）本身沒有這個風險：`k3SettleJackpotIfReady` 要等 cd／of 兩個盤口
 *   都對同一期 submitRows 才會真的分配並寫回 `K3_JACKPOT.carry`；這裡的合成期別只有
 *   'of' 交件，K3-CD 永遠不會對同一個合成期別交件，所以爆池永遠停在「未湊齊」、不會誤動到
 *   真實的爆池滾存。也因此本工具測不到爆池派彩（跟 k3cd-test-settle 的已知限制一樣）。
 *
 * body: {
 *   oddsBets?: Array<{ playKey: string; tabId: number; betCode: string; coin?: number }>  // 賠率制 6 玩法
 *   poolBets?: Array<{ picks: number[]; coin?: number }>                                   // 選號（彩池分層）
 *   openCode: number[]   // 3 顆骰子，1~6
 *   reuseIssue?: string  // 指定要重用的合成期別，測「不重複結算」用
 * }
 */
type OddsBetInput = { playKey?: string; tabId?: number; betCode?: string; coin?: number }
type PoolBetInput = { picks?: number[]; coin?: number }
type Body = {
  oddsBets?: OddsBetInput[]
  poolBets?: PoolBetInput[]
  openCode?: number[]
  reuseIssue?: string
}

export default defineEventHandler(async (event) => {
  const login = sessionController.requireAdmin(event)
  const body = await readBody<Body>(event)

  const oddsBets = Array.isArray(body?.oddsBets) ? body.oddsBets : []
  const poolBets = Array.isArray(body?.poolBets) ? body.poolBets : []
  const openCode = Array.isArray(body?.openCode) ? body.openCode.map(Number) : []
  if (
    (oddsBets.length === 0 && poolBets.length === 0) ||
    openCode.length !== 3 ||
    openCode.some((n) => !(n >= 1 && n <= 6))
  ) {
    throw createError({ statusCode: 400, message: 'oddsBets/poolBets 至少一項要有內容，openCode 需為 3 個 1~6 的數字' })
  }

  const game = Storage.games[LOTTERY['K3-OF'].key] as any
  if (!game) throw createError({ statusCode: 503, message: 'K3-OF 尚未初始化' })

  const testIssue = body?.reuseIssue || `TEST-K3OF-${Date.now()}`
  const alreadySettledBefore = Boolean(game.issueSettledMap[testIssue])
  const orders = game._get.orders()

  const orderIds: string[] = []

  oddsBets.forEach((bet) => {
    const playKey = String(bet?.playKey ?? '')
    const tabId = Number(bet?.tabId)
    const betCode = String(bet?.betCode ?? '')
    const coin = Number(bet?.coin ?? 100)
    const odds = k3OfTabOddsOf(playKey, tabId, betCode)
    const orderId = game.handle.createOrderId(testIssue)

    orders.add.record({
      issue: testIssue, userId: login.id, coin, orderId, tabId: game.id,
      betCode: [betCode], playKey
    })
    game.handle.appendBetHistory({
      issue: testIssue, user_id: login.id, bet_time: Date.now(), coin,
      order_id: orderId, status: 'success', bet_code: [betCode],
      play_key: playKey, play_type_name: '', odds, tab_id: tabId
    })
    orderIds.push(orderId)
  })

  poolBets.forEach((bet) => {
    const picks = k3OfPicksOf(Array.isArray(bet?.picks) ? bet.picks : [])
    if (!picks) throw createError({ statusCode: 400, message: '選號玩法每注需 3 個點數（1~6，可重複）' })
    const coin = Number(bet?.coin ?? 100)
    const orderId = game.handle.createOrderId(testIssue)

    orders.add.record({
      issue: testIssue, userId: login.id, coin, orderId, tabId: game.id,
      betCode: picks.map(String), playKey: K3_OF_POOL_PLAY_KEY
    })
    game.handle.appendBetHistory({
      issue: testIssue, user_id: login.id, bet_time: Date.now(), coin,
      order_id: orderId, status: 'success', bet_code: picks.map(String),
      play_key: K3_OF_POOL_PLAY_KEY, play_type_name: '選號', odds: 0, tab_id: 0
    })
    orderIds.push(orderId)
  })

  // ⚠️ 彩池 carry 快照／還原：settleIssuePrize 全程同步、中間沒有 await，
  //    自動結算的 300ms tick 不可能插進這段 try/finally，還原一定完整生效
  const poolCarryBefore = Number(K3_SHARED.pool.carry ?? 0)
  let poolCarryImmediatelyAfterSettle = poolCarryBefore
  try {
    if (!alreadySettledBefore) {
      game.handle.settleIssuePrize(testIssue, openCode.map(String))
      game.issueSettledMap[testIssue] = true
      poolCarryImmediatelyAfterSettle = Number(K3_SHARED.pool.carry ?? 0)
    }
  } finally {
    K3_SHARED.pool.carry = poolCarryBefore
    delete K3_SHARED.pool.issueMap[testIssue]
    delete K3_JACKPOT.pending[testIssue]
  }

  const record = game.handle.ensureUserRecord(game._get.user(login.id))
  const settledRows = orderIds.map((orderId) => record.betHistory.find((row: any) => row.orderId === orderId))
  const claimable = record.claimableIssues.find((row: any) => String(row.issue) === testIssue)

  return {
    testIssue,
    alreadySettledBefore,
    settledRows,
    claimable: claimable ?? null,
    poolCarry: {
      before: poolCarryBefore,
      wouldHaveChangedToWithoutGuard: poolCarryImmediatelyAfterSettle,
      restoredTo: Number(K3_SHARED.pool.carry ?? 0)
    }
  }
})
