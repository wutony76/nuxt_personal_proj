import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'
import { pk10OfTabOddsOf } from '#shared/config/pk10of/helpers'
import { pk10OfPicksOf, PK10_OF_POOL_PLAY_KEY } from '#shared/config/pk10-of'
import { PK10_SHARED, PK10_JACKPOT } from '../../services/game/lottery/bg/pk10Shared'

/**
 * PK10 官方盤（PK10-OF）開發用測試工具：手動模擬開獎結算，不用等真實開獎週期。
 *
 * ⚠️⚠️ 跟 K3-OF 的 `K3_SHARED.pool.carry` 完全同構的坑：`settleIssuePrize()` 尾端會
 *   **無條件**執行 `PK10_SHARED.pool.carry = carryNext`（`pk10Of.ts:588`），不管這次
 *   結算有沒有前三直選（qiansan）注單都會跑到——沒人中的層會把整層 tierPool 累加進
 *   carryNext，等於用合成測試的計算結果蓋掉與 PK10-CD 共用的正式彩池滾存。
 *   做法同 K3-OF：呼叫前存快照、呼叫後在同一個 synchronous try/finally 內立刻還原。
 *
 * ⚠️ 爆池（PK10_JACKPOT）本身不需要這層防護：`pk10SettleJackpotIfReady` 要等 cd／of
 *   兩個盤口都對同一期 submitRows 才會真的分配並寫回 `PK10_JACKPOT.carry`；這裡的合成
 *   期別只有 'of' 交件，PK10-CD 永遠不會對同一個合成期別交件，所以爆池永遠停在
 *   「未湊齊」、不會誤動到真實的爆池滾存（跟 k3of-test-settle 的已知限制一樣）。
 *
 * body: {
 *   oddsBets?: Array<{ playKey: string; tabId: number; betCode: string; coin?: number }>  // qianyi/qianer/dingwei
 *   poolBets?: Array<{ picks: number[]; coin?: number }>                                   // qiansan（前三直選，依序冠/亞/季）
 *   openCode: Array<string|number>   // 10 個：1~10 的排列
 *   reuseIssue?: string              // 指定要重用的合成期別，測「不重複結算」用
 * }
 */
type OddsBetInput = { playKey?: string; tabId?: number; betCode?: string; coin?: number }
type PoolBetInput = { picks?: number[]; coin?: number }
type Body = {
  oddsBets?: OddsBetInput[]
  poolBets?: PoolBetInput[]
  openCode?: Array<string | number>
  reuseIssue?: string
}

export default defineEventHandler(async (event) => {
  const login = sessionController.requireAdmin(event)
  const body = await readBody<Body>(event)

  const oddsBets = Array.isArray(body?.oddsBets) ? body.oddsBets : []
  const poolBets = Array.isArray(body?.poolBets) ? body.poolBets : []
  const rawOpenCode = Array.isArray(body?.openCode) ? body.openCode : []
  const openCode = rawOpenCode.map((code) => String(Number(code)).padStart(2, '0'))
  const cars = openCode.map((code) => Number(code))
  const validOpenCode = cars.length === 10 && cars.every((n) => n >= 1 && n <= 10) && new Set(cars).size === 10
  if ((oddsBets.length === 0 && poolBets.length === 0) || !validOpenCode) {
    throw createError({ statusCode: 400, message: 'oddsBets/poolBets 至少一項要有內容，openCode 需為 1~10 的排列（10個）' })
  }

  const game = Storage.games[LOTTERY['PK10-OF'].key] as any
  if (!game) throw createError({ statusCode: 503, message: 'PK10-OF 尚未初始化' })

  const testIssue = body?.reuseIssue || `TEST-PK10OF-${Date.now()}`
  const alreadySettledBefore = Boolean(game.issueSettledMap[testIssue])
  const orders = game._get.orders()

  const orderIds: string[] = []

  oddsBets.forEach((bet) => {
    const playKey = String(bet?.playKey ?? '')
    const tabId = Number(bet?.tabId)
    const betCode = String(bet?.betCode ?? '')
    const coin = Number(bet?.coin ?? 100)
    const odds = pk10OfTabOddsOf(playKey, tabId, betCode)
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
    const picks = pk10OfPicksOf(Array.isArray(bet?.picks) ? bet.picks : [])
    if (!picks) throw createError({ statusCode: 400, message: '前三直選每注需依序選 3 個不重複的車號（1~10）' })
    const coin = Number(bet?.coin ?? 100)
    const orderId = game.handle.createOrderId(testIssue)

    orders.add.record({
      issue: testIssue, userId: login.id, coin, orderId, tabId: game.id,
      betCode: picks.map(String), playKey: PK10_OF_POOL_PLAY_KEY
    })
    game.handle.appendBetHistory({
      issue: testIssue, user_id: login.id, bet_time: Date.now(), coin,
      order_id: orderId, status: 'success', bet_code: picks.map(String),
      play_key: PK10_OF_POOL_PLAY_KEY, play_type_name: '前三直選', odds: 0, tab_id: 0
    })
    orderIds.push(orderId)
  })

  // ⚠️ 彩池 carry 快照／還原：settleIssuePrize 全程同步、中間沒有 await，
  //    自動結算的 300ms tick 不可能插進這段 try/finally，還原一定完整生效
  const poolCarryBefore = Number(PK10_SHARED.pool.carry ?? 0)
  let poolCarryImmediatelyAfterSettle = poolCarryBefore
  try {
    if (!alreadySettledBefore) {
      game.handle.settleIssuePrize(testIssue, openCode)
      game.issueSettledMap[testIssue] = true
      poolCarryImmediatelyAfterSettle = Number(PK10_SHARED.pool.carry ?? 0)
    }
  } finally {
    PK10_SHARED.pool.carry = poolCarryBefore
    delete PK10_SHARED.pool.issueMap[testIssue]
    delete PK10_JACKPOT.pending[testIssue]
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
      restoredTo: Number(PK10_SHARED.pool.carry ?? 0)
    }
  }
})
