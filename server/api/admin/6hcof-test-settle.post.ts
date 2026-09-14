import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'

/**
 * 六合彩官方盤（6HC-OF）開發用測試工具：手動模擬開獎結算，不用等真實開獎週期（每期 7 分鐘）。
 *
 * 玩法很單純：一注 = 選任意幾個號碼（1~49），依「命中幾顆正碼＋是否命中特別號」的組合
 * 對到 ISSUE_PRIZE_TIERS 的其中一層（頭獎~七獎），跟 6HC-CD 完全獨立（各自的
 * recordOpenCode／carryJackpot／注單表，互不共用），跟 K3 系列不同。
 *
 * ⚠️⚠️ 跟 6HC-CD／K3-OF 同構的坑：`settleIssuePrize()` 尾端一樣無條件執行
 *   `this.carryJackpot = carryNext`（`6hcOf.ts:344`）。只要合成測試命中任一 pool 型分層
 *   （頭獎/二獎/三獎）造成實際派彩，就會真的把獎池分掉一部分、永久改掉這個 6HC-OF 單例
 *   共用的 `carryJackpot`。做法同前兩支：呼叫前存快照、呼叫後在同一個 synchronous
 *   try/finally 內立刻還原。
 *
 * body: {
 *   bets: Array<{ betCode: Array<string|number>; coin?: number }>  // 一注選的號碼（不限 6 個）
 *   openCode: Array<string|number>   // 7 個：6 正碼 + 1 特別號
 *   reuseIssue?: string              // 指定要重用的合成期別，測「不重複結算」用
 *   seedIssuePool?: number           // 供彩池安全性測試：先幫該合成期別注入一筆抽水
 * }
 */
type BetInput = { betCode?: Array<string | number>; coin?: number }
type Body = {
  bets?: BetInput[]
  openCode?: Array<string | number>
  reuseIssue?: string
  seedIssuePool?: number
}

export default defineEventHandler(async (event) => {
  const login = sessionController.requireAdmin(event)
  const body = await readBody<Body>(event)

  const bets = Array.isArray(body?.bets) ? body.bets : []
  const rawOpenCode = Array.isArray(body?.openCode) ? body.openCode : []
  if (bets.length === 0 || rawOpenCode.length !== 7) {
    throw createError({ statusCode: 400, message: 'bets(至少1筆) / openCode(7個：6正碼+1特別號) 為必填' })
  }
  const openCode = rawOpenCode.map((code) => String(Number(code)).padStart(2, '0'))

  const game = Storage.games[LOTTERY['LHC-OF'].key] as any
  if (!game) throw createError({ statusCode: 503, message: '6HC-OF 尚未初始化' })

  const testIssue = body?.reuseIssue || `TEST-LHCOF-${Date.now()}`
  const alreadySettledBefore = Boolean(game.issueSettledMap[testIssue])
  const orders = game._get.orders()

  const orderIds: string[] = []
  bets.forEach((bet) => {
    const betCode = (Array.isArray(bet?.betCode) ? bet.betCode : []).map((code) => String(Number(code)).padStart(2, '0'))
    const coin = Number(bet?.coin ?? 100)
    const orderId = game.handle.createOrderId(testIssue)

    orders.add.record({ issue: testIssue, userId: login.id, coin, orderId, betCode })
    game.handle.appendBetHistory({
      order_id: orderId, issue: testIssue, user_id: login.id, bet_time: Date.now(),
      coin, bet_count: 1, bet_code: betCode, status: 'success'
    })
    orderIds.push(orderId)
  })

  // ⚠️ carryJackpot 快照／還原：settleIssuePrize 全程同步、中間沒有 await，
  //    自動結算的 300ms tick 不可能插進這段 try/finally，還原一定完整生效
  const carryJackpotBefore = Number(game.carryJackpot ?? 0)
  if (Number(body?.seedIssuePool) > 0) {
    game.handle.addIssueJackpot(testIssue, Number(body.seedIssuePool))
  }
  let carryJackpotImmediatelyAfterSettle = carryJackpotBefore
  try {
    if (!alreadySettledBefore) {
      game.handle.settleIssuePrize(testIssue, openCode)
      game.issueSettledMap[testIssue] = true
      carryJackpotImmediatelyAfterSettle = Number(game.carryJackpot ?? 0)
    }
  } finally {
    game.carryJackpot = carryJackpotBefore
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
    carryJackpot: {
      before: carryJackpotBefore,
      wouldHaveChangedToWithoutGuard: carryJackpotImmediatelyAfterSettle,
      restoredTo: Number(game.carryJackpot ?? 0)
    }
  }
})
