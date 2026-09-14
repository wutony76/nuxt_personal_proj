import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'
import { x5OfTabOddsOf } from '#shared/config/x5of/helpers'
import { X5_OF_POOL_PLAY_KEY, X5_OF_POOL_TAB_IDS, X5_OF_POOL_PREFIX } from '#shared/config/x5-of'
import { X5_SHARED, X5_JACKPOT } from '../../services/game/lottery/bg/x5Shared'

/**
 * 11選5 官方盤（X5-OF）開發用測試工具：手動模擬開獎結算，不用等真實開獎週期。
 *
 * ⚠️⚠️ 跟 SSC-OF／PK10-OF 的 `pool.carry` 完全同構的坑：`settleIssuePrize()` 尾端會
 *   **無條件**執行 `X5_SHARED.pool.carry = carryNext`，不管這次結算有沒有「後三直選」
 *   （sanma 複式/單式兩個 tab）注單都會跑到——沒人中的層會把整層 tierPool 累加進
 *   carryNext，等於用合成測試的計算結果蓋掉與 X5-CD 共用的正式彩池滾存。
 *   做法同前幾支：呼叫前存快照、呼叫後在同一個 synchronous try/finally 內立刻還原。
 *
 * ⚠️ 爆池（X5_JACKPOT）本身不需要這層防護：需要 cd／of 兩個盤口都對同一期 submitRows
 *   才會真的分配並寫回 carry；這裡的合成期別只有 'of' 交件，X5-CD 永遠不會對同一個
 *   合成期別交件，所以爆池永遠停在「未湊齊」、不會誤動到真實的爆池滾存。
 *
 * ⚠️ 「後三直選」是否為彩池分頁由 config 的 combo.pool 決定（`x5OfIsPoolTab`），
 *   本工具用 X5_OF_POOL_TAB_IDS 的第一個 tabId（複式分頁）即可，注碼格式是完整字串
 *   `後三直選010203`（不是座標陣列），跟賠率制分頁存法一致，只是判定路徑不同。
 *
 * body: {
 *   oddsBets?: Array<{ playKey: string; tabId: number; betCode: string; coin?: number }>
 *   poolBets?: Array<{ picks: number[]; coin?: number }>  // 後三直選，依序猜第三/四/五球（1~11不重複）
 *   openCode: Array<string|number>   // 5 個：1~11 且互不重複
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
  const nums = rawOpenCode.map((code) => Number(code))
  const validOpenCode = nums.length === 5
    && nums.every((n) => Number.isInteger(n) && n >= 1 && n <= 11)
    && new Set(nums).size === 5
  if ((oddsBets.length === 0 && poolBets.length === 0) || !validOpenCode) {
    throw createError({ statusCode: 400, message: 'oddsBets/poolBets 至少一項要有內容，openCode 需為 5 個 1~11 且互不重複的數字' })
  }
  const openCode = nums.map((n) => String(n).padStart(2, '0'))

  const game = Storage.games[LOTTERY['X5-OF'].key] as any
  if (!game) throw createError({ statusCode: 503, message: 'X5-OF 尚未初始化' })

  const testIssue = body?.reuseIssue || `TEST-X5OF-${Date.now()}`
  const alreadySettledBefore = Boolean(game.issueSettledMap[testIssue])
  const orders = game._get.orders()

  const orderIds: string[] = []
  const poolTabId = X5_OF_POOL_TAB_IDS[0]

  oddsBets.forEach((bet) => {
    const playKey = String(bet?.playKey ?? '')
    const tabId = Number(bet?.tabId)
    const betCode = String(bet?.betCode ?? '')
    const coin = Number(bet?.coin ?? 100)
    const odds = x5OfTabOddsOf(playKey, tabId, betCode)
    const orderId = game.handle.createOrderId(testIssue)

    orders.add.record({
      issue: testIssue, userId: login.id, coin, orderId, tabId,
      betCode: [betCode], playKey, odds
    })
    game.handle.appendBetHistory({
      issue: testIssue, user_id: login.id, select_tab_id: tabId, bet_time: Date.now(),
      coin, order_id: orderId, status: 'success', bet_code: [betCode],
      play_key: playKey, play_type_name: '', odds
    })
    orderIds.push(orderId)
  })

  poolBets.forEach((bet) => {
    const picks = Array.isArray(bet?.picks) ? bet.picks.map(Number) : []
    const validPicks = picks.length === 3 && picks.every((n) => Number.isInteger(n) && n >= 1 && n <= 11) && new Set(picks).size === 3
    if (!validPicks) {
      throw createError({ statusCode: 400, message: '後三直選每注需依序選 3 個 1~11 且互不重複的數字' })
    }
    const betCode = `${X5_OF_POOL_PREFIX}${picks.map((n) => String(n).padStart(2, '0')).join('')}`
    const coin = Number(bet?.coin ?? 100)
    const orderId = game.handle.createOrderId(testIssue)

    orders.add.record({
      issue: testIssue, userId: login.id, coin, orderId, tabId: poolTabId,
      betCode: [betCode], playKey: X5_OF_POOL_PLAY_KEY
    })
    game.handle.appendBetHistory({
      issue: testIssue, user_id: login.id, select_tab_id: poolTabId, bet_time: Date.now(),
      coin, order_id: orderId, status: 'success', bet_code: [betCode],
      play_key: X5_OF_POOL_PLAY_KEY, play_type_name: '後三直選', odds: 0
    })
    orderIds.push(orderId)
  })

  // ⚠️ 彩池 carry 快照／還原：settleIssuePrize 全程同步、中間沒有 await，
  //    自動結算的 300ms tick 不可能插進這段 try/finally，還原一定完整生效
  const poolCarryBefore = Number(X5_SHARED.pool.carry ?? 0)
  let poolCarryImmediatelyAfterSettle = poolCarryBefore
  try {
    if (!alreadySettledBefore) {
      game.handle.settleIssuePrize(testIssue, openCode)
      game.issueSettledMap[testIssue] = true
      poolCarryImmediatelyAfterSettle = Number(X5_SHARED.pool.carry ?? 0)
    }
  } finally {
    X5_SHARED.pool.carry = poolCarryBefore
    delete X5_SHARED.pool.issueMap[testIssue]
    delete X5_JACKPOT.pending[testIssue]
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
      restoredTo: Number(X5_SHARED.pool.carry ?? 0)
    }
  }
})
