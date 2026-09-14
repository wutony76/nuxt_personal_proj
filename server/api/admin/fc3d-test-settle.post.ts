import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'
import { FC3D_POOL_PLAY_KEY } from '#shared/config/fc3d-of'

/**
 * 福彩3D（FC3D）開發用測試工具：手動模擬開獎結算，不用等真實開獎週期。
 *
 * ⚠️⚠️ 跟 EGGS／KL10／KL8 完全同構的坑，而且 FC3D 同時有**兩個**獨立的池：
 *   FC3D 只有官方盤一個盤口，全站只有一個 instance（`Storage.games['FC3D']`），玩家看到的
 *   全站爆池（`carryJackpot`，開豹子觸發）與三星直選分層彩池（`carryPool`）都是這個 instance
 *   自己的欄位。`settleIssuePrize()` 尾端對兩者都會**無條件**覆寫，不管這次結算有沒有
 *   相關注單、有沒有真的觸發都會執行——沒有 CD/OF 成對盤口那種「等雙方交件才真的分配」
 *   的天然緩衝。所以這裡對 `carryPool`／`carryJackpot`／`lastJackpotHit` 都要
 *   「呼叫前快照、呼叫後同步還原」。
 *
 * ⚠️ `settleIssuePrize` 本身也沒有防重複呼叫的機制，防重複只在外層
 *   `settleClosedIssueIfNeeded()` 用 `issueSettledMap` 擋，這裡自己補一層一樣的 guard。
 *
 * odds 填 0：結算時 `judgeFc3dBet` 會用注碼即時推算的公平賠率（各分頁 rtp 皆為 0.96，
 *   跟真正下注時 `buildOrderRows` 鎖的值一致）。
 *
 * ⚠️ 三星直選（複式/單式，playKey='sanxing' 且該分頁 combo.pool===true）走分層彩池，
 *   不吃固定賠率；本工具用 tabId=181121010（三星直選複式）標記彩池注單。
 *
 * body: {
 *   bets?: Array<{ playKey: string; tabId: number; betCode: string; coin?: number }>  // 定位膽/直選組選/三星和值組三組六/不定位/大小單雙
 *   poolBets?: Array<{ picks: number[]; coin?: number }>                               // 三星直選（依序百/十/個位，可重複）
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

const SANXING_DIRECT_TAB_ID = 181121010

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

  const game = Storage.games[LOTTERY.FC3D.key] as any
  if (!game) throw createError({ statusCode: 503, message: 'FC3D 尚未初始化' })

  const testIssue = body?.reuseIssue || `TEST-FC3D-${Date.now()}`
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
      issue: testIssue, user_id: login.id, tab_id: tabId, bet_time: Date.now(),
      coin, order_id: orderId, status: 'success', bet_code: [betCode],
      play_key: playKey, play_type_name: '', odds: 0
    })
    orderIds.push(orderId)
  })

  poolBets.forEach((bet) => {
    const picks = Array.isArray(bet?.picks) ? bet.picks.map(Number) : []
    if (picks.length !== 3 || picks.some((n) => !Number.isInteger(n) || n < 0 || n > 9)) {
      throw createError({ statusCode: 400, message: '三星直選每注需依序 3 個 0~9 的數字（可重複）' })
    }
    const betCode = `三星直選${picks.join('')}`
    const coin = Number(bet?.coin ?? 100)
    const orderId = game.handle.createOrderId(testIssue)

    game._get.orders().add.record({
      issue: testIssue, userId: login.id, coin, orderId, tabId: SANXING_DIRECT_TAB_ID,
      betCode: [betCode], playKey: FC3D_POOL_PLAY_KEY, odds: 0
    })
    game.handle.appendBetHistory({
      issue: testIssue, user_id: login.id, tab_id: SANXING_DIRECT_TAB_ID, bet_time: Date.now(),
      coin, order_id: orderId, status: 'success', bet_code: [betCode],
      play_key: FC3D_POOL_PLAY_KEY, play_type_name: '三星直選', odds: 0
    })
    orderIds.push(orderId)
  })

  // ⚠️ 全站唯一 instance 的兩個池快照與還原：settleIssuePrize 全程同步、中間沒有 await，
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
