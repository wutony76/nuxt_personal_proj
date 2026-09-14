import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'
import { sscOfTabOddsOf } from '#shared/config/sscof/helpers'
import { SSC_OF_POOL_PLAY_KEY, SSC_OF_POOL_TAB_ID, SSC_OF_POOL_PREFIX } from '#shared/config/ssc-of'
import { SSC_SHARED, SSC_JACKPOT } from '../../services/game/lottery/bg/sscShared'

/**
 * 時時彩官方盤（SSC-OF）開發用測試工具：手動模擬開獎結算，不用等真實開獎週期。
 *
 * ⚠️⚠️ 跟 PK10-OF 的 `PK10_SHARED.pool.carry` 完全同構的坑：`settleIssuePrize()` 尾端會
 *   **無條件**執行 `SSC_SHARED.pool.carry = carryNext`（`sscOf.ts:559`），不管這次結算有
 *   沒有後三直選（housan）注單都會跑到——沒人中的層會把整層 tierPool 累加進 carryNext，
 *   等於用合成測試的計算結果蓋掉與 SSC-CD 共用的正式彩池滾存。
 *   做法同 PK10-OF：呼叫前存快照、呼叫後在同一個 synchronous try/finally 內立刻還原。
 *
 * ⚠️ 爆池（SSC_JACKPOT）本身不需要這層防護：`sscSettleJackpotIfReady` 要等 cd／of
 *   兩個盤口都對同一期 submitRows 才會真的分配並寫回 `SSC_JACKPOT.carry`；這裡的合成
 *   期別只有 'of' 交件，SSC-CD 永遠不會對同一個合成期別交件，所以爆池永遠停在
 *   「未湊齊」、不會誤動到真實的爆池滾存（跟 pk10of-test-settle 的已知限制一樣）。
 *
 * ⚠️ 後三直選（housan）分頁靠 `playKey==='housan' 且 tabId===101141010` 才會被結算端
 *   判成彩池注單（`sscOfIsPoolTab`），注碼格式是完整字串 `後三直選123`（不是座標陣列），
 *   跟賠率制分頁存法一致，只是判定路徑不同。
 *
 * body: {
 *   oddsBets?: Array<{ playKey: string; tabId: number; betCode: string; coin?: number }>  // dingwei/erxing/wuxing/daxiao
 *   poolBets?: Array<{ picks: number[]; coin?: number }>                                   // housan 後三直選（依序百/十/個）
 *   openCode: Array<string|number>   // 5 個：0~9（可重複）
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
  const digits = rawOpenCode.map((code) => Number(code))
  const validOpenCode = digits.length === 5 && digits.every((n) => Number.isInteger(n) && n >= 0 && n <= 9)
  if ((oddsBets.length === 0 && poolBets.length === 0) || !validOpenCode) {
    throw createError({ statusCode: 400, message: 'oddsBets/poolBets 至少一項要有內容，openCode 需為 5 個 0~9 的數字' })
  }
  const openCode = digits.map(String)

  const game = Storage.games[LOTTERY['SSC-OF'].key] as any
  if (!game) throw createError({ statusCode: 503, message: 'SSC-OF 尚未初始化' })

  const testIssue = body?.reuseIssue || `TEST-SSCOF-${Date.now()}`
  const alreadySettledBefore = Boolean(game.issueSettledMap[testIssue])
  const orders = game._get.orders()

  const orderIds: string[] = []

  oddsBets.forEach((bet) => {
    const playKey = String(bet?.playKey ?? '')
    const tabId = Number(bet?.tabId)
    const betCode = String(bet?.betCode ?? '')
    const coin = Number(bet?.coin ?? 100)
    const odds = sscOfTabOddsOf(playKey, tabId, betCode)
    const orderId = game.handle.createOrderId(testIssue)

    orders.add.record({
      issue: testIssue, userId: login.id, coin, orderId, tabId,
      betCode: [betCode], playKey, odds
    })
    game.handle.appendBetHistory({
      issue: testIssue, user_id: login.id, bet_time: Date.now(), coin,
      order_id: orderId, status: 'success', bet_code: [betCode],
      play_key: playKey, play_type_name: '', odds, tab_id: tabId
    })
    orderIds.push(orderId)
  })

  poolBets.forEach((bet) => {
    const picks = Array.isArray(bet?.picks) ? bet.picks.map(Number) : []
    if (picks.length !== 3 || picks.some((n) => !Number.isInteger(n) || n < 0 || n > 9)) {
      throw createError({ statusCode: 400, message: '後三直選每注需依序選 3 個 0~9 的數字（百/十/個位，可重複）' })
    }
    const betCode = `${SSC_OF_POOL_PREFIX}${picks.join('')}`
    const coin = Number(bet?.coin ?? 100)
    const orderId = game.handle.createOrderId(testIssue)

    orders.add.record({
      issue: testIssue, userId: login.id, coin, orderId, tabId: SSC_OF_POOL_TAB_ID,
      betCode: [betCode], playKey: SSC_OF_POOL_PLAY_KEY
    })
    game.handle.appendBetHistory({
      issue: testIssue, user_id: login.id, bet_time: Date.now(), coin,
      order_id: orderId, status: 'success', bet_code: [betCode],
      play_key: SSC_OF_POOL_PLAY_KEY, play_type_name: '後三直選', odds: 0, tab_id: SSC_OF_POOL_TAB_ID
    })
    orderIds.push(orderId)
  })

  // ⚠️ 彩池 carry 快照／還原：settleIssuePrize 全程同步、中間沒有 await，
  //    自動結算的 300ms tick 不可能插進這段 try/finally，還原一定完整生效
  const poolCarryBefore = Number(SSC_SHARED.pool.carry ?? 0)
  let poolCarryImmediatelyAfterSettle = poolCarryBefore
  try {
    if (!alreadySettledBefore) {
      game.handle.settleIssuePrize(testIssue, openCode)
      game.issueSettledMap[testIssue] = true
      poolCarryImmediatelyAfterSettle = Number(SSC_SHARED.pool.carry ?? 0)
    }
  } finally {
    SSC_SHARED.pool.carry = poolCarryBefore
    delete SSC_SHARED.pool.issueMap[testIssue]
    delete SSC_JACKPOT.pending[testIssue]
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
      restoredTo: Number(SSC_SHARED.pool.carry ?? 0)
    }
  }
})
