import { sessionController } from '../../services/auth'
import { Storage } from '../../services/storage'
import { LOTTERY } from '~/config/constants'
import { creditTabOddsOf, creditTiersOf } from '#shared/config/cd/helpers'

/**
 * 六合彩信用盤（6HC-CD）開發用測試工具：手動模擬開獎結算，不用等真實開獎週期（每期 7 分鐘）。
 *
 * ⚠️⚠️ 跟 K3-OF 的 `K3_SHARED.pool.carry` 同構的坑：`settleIssuePrize()` 尾端會**無條件**執行
 *   `this.carryJackpot = jackpot.remain`（`6hcCd.ts:628`）。大多數情況下 `remain` 剛好等於呼叫前的值
 *   （非爆池期或未達門檻時直接原樣退回），但只要合成測試的 `specialCode===49` 且可發放池
 *   （`issueJackpotMap[issue] + carryJackpot`）≥ 1000 又有中獎注單，就會真的把獎池分掉一部分、
 *   永久改掉這個 6HC-CD 單例共用的 `carryJackpot`——不像 K3 是跨 CD/OF 兩個盤口共用，
 *   這裡是跨「同一個 instance 內、不同次測試呼叫」共用。做法同 K3-OF：呼叫前存快照、
 *   呼叫後在同一個 synchronous try/finally 內立刻還原，避免測試污染正式彩池。
 *
 * ⚠️ 6HC-CD 沒有像 K3 那樣與其他盤口（6HC-OF）共用開獎號／彩池／注單表——兩者完全獨立、
 *   各自 `recordOpenCode`。唯一要注意的是本工具產生的合成注單一定要走
 *   `creditTabOddsOf`/`creditTiersOf` 鎖賠率（比照 `buildOrderRows` 的真實流程），
 *   不能偷懶填 0：特碼 B 盤（tabId 2001）等分頁的賠率與 A 盤不同，`judgeCreditTemaBet`
 *   現場推算只認 A 盤賠率，注單沒鎖對值就會結算成錯的賠率。
 *
 * ⚠️ 五行／一肖／特肖／合肖／連肖的賠率逐年輪轉，取決於「期別年份」（`issue.slice(0,4)`）。
 *   本工具預設用 `2026TEST-LHCCD-<timestamp>` 當合成期別，把年份釘死在 2026，
 *   測試斷言才不會因為執行日期跨年而失準；如要測別的年份可用 `reuseIssue` 自訂前 4 碼。
 *
 * body: {
 *   bets: Array<{
 *     playKey: string; tabId: number
 *     betCode?: string           // 單一注碼玩法（tema/zhengma/zhengmate/qima/wuxing/banbo/
 *                                //   texiao/yixiao/weishu/ixiaolian/weishulian）
 *     betCodes?: string[]        // 組合玩法（lianma/hexiao/lianxiao/lianwei/zixuanbuzhong/
 *                                //   duoxuanzhongyi/zhengterenzhong）一注帶的號碼組
 *     coin?: number
 *   }>
 *   openCode: Array<string|number>  // 7 個：6 正碼 + 1 特別號
 *   reuseIssue?: string             // 指定要重用的合成期別，測「不重複結算」用
 *   seedIssuePool?: number          // 供彩池安全性測試：先幫該合成期別注入一筆爆池抽水
 * }
 */
const COMBO_PLAY_KEYS = new Set([
  'lianma', 'hexiao', 'lianxiao', 'lianwei', 'zixuanbuzhong', 'duoxuanzhongyi', 'zhengterenzhong'
])

type BetInput = { playKey?: string; tabId?: number; betCode?: string; betCodes?: string[]; coin?: number }
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

  const game = Storage.games[LOTTERY['LHC-CD'].key] as any
  if (!game) throw createError({ statusCode: 503, message: '6HC-CD 尚未初始化' })

  const testIssue = body?.reuseIssue || `2026TEST-LHCCD-${Date.now()}`
  const year = Number(String(testIssue).slice(0, 4)) || new Date().getFullYear()
  const alreadySettledBefore = Boolean(game.issueSettledMap[testIssue])
  const orders = game._get.orders()

  const orderIds: string[] = []
  bets.forEach((bet) => {
    const playKey = String(bet?.playKey ?? '')
    const tabId = Number(bet?.tabId)
    const isCombo = COMBO_PLAY_KEYS.has(playKey)
    const betCodes = isCombo
      ? (Array.isArray(bet?.betCodes) ? bet.betCodes.map(String) : [])
      : [String(bet?.betCode ?? '')]
    const coin = Number(bet?.coin ?? 100)
    const orderId = game.handle.createOrderId(testIssue)

    // 比照 buildOrderRows（6hcCd.ts:330-336）：分頁單注賠率優先，查不到才退回單檔連碼 tiers
    const tiers = creditTiersOf(playKey, tabId)
    const itemOdds = creditTabOddsOf(playKey, tabId, betCodes[0], year, betCodes)
    const lockedTierOdds = tiers.length === 1 ? Number(tiers[0]?.odds ?? 0) : 0
    const odds = itemOdds > 0 ? itemOdds : lockedTierOdds

    orders.add.record({
      issue: testIssue, userId: login.id, coin, orderId, tabId,
      betCode: betCodes, playKey, odds, ...(tiers.length > 0 ? { tiers } : {})
    })
    game.handle.appendBetHistory({
      issue: testIssue, user_id: login.id, select_tab_id: tabId, bet_time: Date.now(),
      coin, order_id: orderId, status: 'success', bet_code: betCodes,
      play_key: playKey, play_type_name: '', odds, ...(tiers.length > 0 ? { tiers } : {})
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
    year,
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
