#!/usr/bin/env node
/**
 * PC蛋蛋（EGGS）隨時可跑的端到端測試腳本。
 *
 * 用法：
 *   npm run test:eggs
 *   node test/test-eggs.mjs
 *   BASE_URL=http://localhost:6100 node test/test-eggs.mjs
 *
 * 前提：同其他彩種——dev server 要跑著、用種子帳號登入、依賴保留下來的
 * 管理員限定測試工具 server/api/admin/eggs-test-settle.post.ts。
 *
 * ⚠️ EGGS 是單一盤口（沒有 CD/OF 之分），全站只有一個 instance，玩家看到的
 * 彩池／爆池滾存就是這個 instance 的 `carryPool`／`carryJackpot` 兩個欄位。
 * 跟其他彩種（K3/6HC/PK10/SSC/11選5）的 CD/OF 成對盤口不同，EGGS 沒有
 * 「等其他盤口交件才真的分配爆池」的天然緩衝——結算是單次呼叫就直接算完寫入，
 * 所以測試工具對 `carryPool`／`carryJackpot`／`lastJackpotHit` 都要「呼叫前快照、
 * 呼叫後同步還原」，本測試腳本的「彩池與爆池安全性」段落會直接驗證這點。
 *
 * 涵蓋範圍：
 *   1. 當期資訊格式（issue／openCode，3 個 0~9 可重複）
 *   2. 正常下注（固定賠率玩法／選號彩池玩法）與拒單（不存在的注碼）且確認未扣款
 *   3. 5 個固定賠率玩法判定與賠率：大小（含極大/極小）、單雙（含大單/小單/大雙/小雙
 *      複合面）、特殊玩法（豹子/對子/順子）、色波、特碼（0~27 直選）；
 *      以及「無法辨識注碼視為和局全額退還」的邊界
 *   4. 選號（xuanhao）彩池玩法依命中顆數分層：頭獎/二獎（彩池比例＋最低保障，
 *      只驗證分層與 floor）、三獎（固定 2 倍，可精確驗證）
 *   5. ⚠️ 彩池與爆池安全性：settleIssuePrize 結算尾端會無條件覆寫
 *      `carryPool`／`carryJackpot`（開出豹子時還會觸發真的爆池分配）。
 *      驗證測試工具的「呼叫前快照、呼叫後還原」機制確實擋下了這個會永久污染
 *      正式彩池／爆池的風險
 *   6. 已結算期別不重複結算（冪等性）
 *
 * ⚠️ 這支腳本會留下測試紀錄（不清除也不需要清除），所有測試期別都是獨立的合成期別
 * （`TEST-EGGS-*`），不會動到真實的 currentIndex／recordOpenCode。
 */

import { createTestRunner } from './_test-utils.mjs'

const { api, ok, section, login, summary, waitForOpen } = createTestRunner()

async function getCoin() {
  const { body } = await api('/api/lottery/userInfo?lottery=EGGS')
  return Number(body?.coin ?? NaN)
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery/eggs/current')
  ok('current API 回 200', status === 200)
  ok('issue 有值', typeof body?.issue === 'string' && body.issue.length > 0, body?.issue)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('openCode 為 3 顆球', Array.isArray(body?.openCode) && body.openCode.length === 3)
}

async function testBetting() {
  section('下注與拒單')
  await waitForOpen('/api/lottery/eggs/current')
  const before = await getCoin()

  const oddsBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 5001, key: 'EGGS' },
      amount: 100,
      groups: [{ playKey: 'daxiao', playTypeName: '大小', selectTabId: 50000, playList: [{ label: '大', amount: 100 }] }]
    })
  })
  ok('大小下注成功', oddsBet.status === 200 && oddsBet.body?.orders?.length === 1, JSON.stringify(oddsBet.body))

  const poolBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 5001, key: 'EGGS' },
      amount: 10,
      groups: [{ playKey: 'xuanhao', playTypeName: '選號', playList: [{ codes: [3, 3, 4], amount: 10 }] }]
    })
  })
  ok('選號下注成功', poolBet.status === 200 && poolBet.body?.orders?.length === 1, JSON.stringify(poolBet.body))

  const after = await getCoin()
  ok(
    '扣款金額正確（100 + 10 = 110）',
    Number.isFinite(before) && Number.isFinite(after) && Math.abs((before - after) - 110) < 0.001,
    `before=${before} after=${after}`
  )

  const balanceBeforeReject = await getCoin()
  const invalidCode = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 5001, key: 'EGGS' },
      amount: 100,
      groups: [{ playKey: 'daxiao', selectTabId: 50000, playList: [{ label: '不存在', amount: 100 }] }]
    })
  })
  ok('拒單：不存在的注碼 → 400', invalidCode.status === 400)
  const balanceAfterReject = await getCoin()
  ok(
    '拒單未扣款',
    Math.abs(balanceBeforeReject - balanceAfterReject) < 0.001,
    `before=${balanceBeforeReject} after=${balanceAfterReject}`
  )
}

async function settle(payload, reuseIssue) {
  return api('/api/admin/eggs-test-settle', {
    method: 'POST',
    body: JSON.stringify({ ...payload, ...(reuseIssue ? { reuseIssue } : {}) })
  })
}

async function testPlayJudging() {
  section('5 個固定賠率玩法判定與派彩')

  const cases = [
    { name: '大小「大」中獎（和值=15>13）', playKey: 'daxiao', tabId: 50000, betCode: '大', openCode: [9, 4, 2], winAmount: 194 },
    { name: '大小「極大」中獎（和值=25，落在22~27）', playKey: 'daxiao', tabId: 50000, betCode: '極大', openCode: [9, 9, 7], winAmount: 259.8, coin: 15 },
    { name: '大小「極小」中獎（和值=3，落在0~5）', playKey: 'daxiao', tabId: 50000, betCode: '極小', openCode: [0, 0, 3], winAmount: 259.8, coin: 15 },
    { name: '單雙「單」中獎（和值=15為奇）', playKey: 'danshuang', tabId: 50001, betCode: '單', openCode: [9, 4, 2], winAmount: 97, coin: 50 },
    { name: '單雙「大單」中獎（和值=15，>13且奇）', playKey: 'danshuang', tabId: 50001, betCode: '大單', openCode: [9, 4, 2], winAmount: 838, coin: 200 },
    { name: '特殊玩法「豹子」中獎（開出333）', playKey: 'tese', tabId: 50002, betCode: '豹子', openCode: [3, 3, 3], winAmount: 970, coin: 10 },
    { name: '特殊玩法「豹子」不中（開出123，是順子非豹子）', playKey: 'tese', tabId: 50002, betCode: '豹子', openCode: [1, 2, 3], winAmount: 0, coin: 10 },
    { name: '特殊玩法「順子」中獎（開出456連號）', playKey: 'tese', tabId: 50002, betCode: '順子', openCode: [4, 5, 6], winAmount: 404, coin: 20 },
    { name: '色波「紅波」中獎（和值=12在紅波表內）', playKey: 'sebo', tabId: 50003, betCode: '紅波', openCode: [9, 2, 1], winAmount: 87.6, coin: 30 },
    { name: '特碼「13」中獎（和值=13）', playKey: 'tema', tabId: 50004, betCode: '13', openCode: [9, 4, 0], winAmount: 1293 },
    { name: '特碼「0」中獎（開出000，同時是豹子）', playKey: 'tema', tabId: 50004, betCode: '0', openCode: [0, 0, 0], winAmount: 4850, coin: 5 },
    { name: '⚠️ 無法辨識注碼視為和局全額退還', playKey: 'daxiao', tabId: 50000, betCode: '亂碼XYZ', openCode: [9, 4, 0], winAmount: 100 }
  ]

  for (const testCase of cases) {
    const coin = testCase.coin ?? 100
    const { status, body } = await settle({
      bets: [{ playKey: testCase.playKey, tabId: testCase.tabId, betCode: testCase.betCode, coin }],
      openCode: testCase.openCode
    })
    const row = body?.settledRows?.[0]
    const expectStatus = testCase.winAmount > 0 ? 'win' : 'lose'
    // 無法辨識注碼那筆的期望狀態是 tie，其餘照 winAmount 判斷
    const expected = testCase.betCode === '亂碼XYZ' ? 'tie' : expectStatus
    ok(
      testCase.name,
      status === 200 && row?.winStatus === expected && Number(row?.winAmount) === testCase.winAmount,
      JSON.stringify(row)
    )
  }
}

async function testPoolTiers() {
  section('選號（xuanhao）彩池玩法依命中顆數分層')

  const fixedTier = await settle({ poolBets: [{ picks: [3, 9, 9], coin: 25 }], openCode: [3, 3, 4] })
  const fixedRow = fixedTier.body?.settledRows?.[0]
  ok(
    '命中1顆 → 三獎（固定倍數，可精確驗證：2 × 25 = 50）',
    fixedTier.status === 200 && fixedRow?.matchCount === 1 && Number(fixedRow?.winAmount) === 50,
    JSON.stringify(fixedRow)
  )

  const secondTier = await settle({ poolBets: [{ picks: [3, 3, 9], coin: 10 }], openCode: [3, 3, 4] })
  const secondRow = secondTier.body?.settledRows?.[0]
  ok(
    '命中2顆 → 二獎（彩池比例，只驗證命中數與正派彩，不驗證精確金額——與即時彩池餘額有關）',
    secondTier.status === 200 && secondRow?.matchCount === 2 && Number(secondRow?.winAmount) > 0,
    JSON.stringify(secondRow)
  )

  const topTier = await settle({ poolBets: [{ picks: [3, 3, 4], coin: 10 }], openCode: [3, 3, 4] })
  const topRow = topTier.body?.settledRows?.[0]
  ok(
    '命中3顆（全對）→ 頭獎（彩池比例＋最低保障 20000，只驗證命中數與門檻）',
    topTier.status === 200 && topRow?.matchCount === 3 && Number(topRow?.winAmount) >= 20000,
    JSON.stringify(topRow)
  )

  const noHit = await settle({ poolBets: [{ picks: [8, 9, 9], coin: 10 }], openCode: [3, 3, 4] })
  const noHitRow = noHit.body?.settledRows?.[0]
  ok(
    '完全不中 → lose、0 顆命中',
    noHit.status === 200 && noHitRow?.matchCount === 0 && noHitRow?.winStatus === 'lose' && Number(noHitRow?.winAmount) === 0,
    JSON.stringify(noHitRow)
  )
}

async function testPoolAndJackpotSafety() {
  section('彩池與爆池安全性（驗證測試不會污染正式 carryPool／carryJackpot）')

  const { status, body } = await settle({
    bets: [{ playKey: 'tese', tabId: 50002, betCode: '豹子', coin: 1000 }],
    openCode: [7, 7, 7]
  })
  ok('豹子測試結算成功（同時觸發爆池）', status === 200 && body?.settledRows?.[0]?.winStatus === 'win', JSON.stringify(body?.settledRows?.[0]))
  ok(
    '測試工具回報：若沒有快照還原機制，carryJackpot 真的會被覆寫成不同的值',
    Number(body?.carryJackpot?.before) !== Number(body?.carryJackpot?.wouldHaveChangedToWithoutGuard),
    JSON.stringify(body?.carryJackpot)
  )
  ok(
    '測試工具回報：還原後的 carryJackpot 等於呼叫前的快照',
    Number(body?.carryJackpot?.restoredTo) === Number(body?.carryJackpot?.before),
    JSON.stringify(body?.carryJackpot)
  )

  const poolResult = await settle({ poolBets: [{ picks: [1, 2, 3], coin: 10 }], openCode: [1, 2, 3] })
  ok(
    '選號頭獎測試也會讓 carryPool 的計算結果不同（驗證風險存在）',
    Number(poolResult.body?.carryPool?.before) !== Number(poolResult.body?.carryPool?.wouldHaveChangedToWithoutGuard),
    JSON.stringify(poolResult.body?.carryPool)
  )
  ok(
    '選號頭獎測試後 carryPool 仍正確還原',
    Number(poolResult.body?.carryPool?.restoredTo) === Number(poolResult.body?.carryPool?.before),
    JSON.stringify(poolResult.body?.carryPool)
  )
}

async function testIdempotency() {
  section('已結算期別不重複結算（冪等性）')
  const reuseIssue = `TEST-EGGS-IDEMPOTENT-${Date.now()}`

  const first = await settle(
    { bets: [{ playKey: 'tema', tabId: 50004, betCode: '13', coin: 100 }], openCode: [9, 4, 0] },
    reuseIssue
  )
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：可領金額正確（1293）', Number(first.body?.claimable?.amount) === 1293)

  const second = await settle(
    { bets: [{ playKey: 'tema', tabId: 50004, betCode: '13', coin: 100 }], openCode: [9, 4, 0] },
    reuseIssue
  )
  ok('第二次呼叫：alreadySettledBefore = true', second.body?.alreadySettledBefore === true)
  ok(
    '第二次呼叫：新注單維持 pending（不會被結算）',
    second.body?.settledRows?.[0]?.winStatus === 'pending',
    JSON.stringify(second.body?.settledRows?.[0])
  )
  ok(
    '可領金額沒有被重複疊加（維持 1293，不是 2586）',
    Number(second.body?.claimable?.amount) === 1293,
    `claimable=${second.body?.claimable?.amount}`
  )
}

async function main() {
  console.log('EGGS 測試腳本開始')
  await login()
  await testCurrentInfo()
  await testBetting()
  await testPlayJudging()
  await testPoolTiers()
  await testPoolAndJackpotSafety()
  await testIdempotency()

  summary()
}

main().catch((err) => {
  console.error('測試腳本執行時發生未預期錯誤：', err)
  process.exitCode = 1
})
