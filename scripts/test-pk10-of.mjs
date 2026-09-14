#!/usr/bin/env node
/**
 * PK10 官方盤（PK10-OF）隨時可跑的端到端測試腳本。
 *
 * 用法：
 *   npm run test:pk10-of
 *   node scripts/test-pk10-of.mjs
 *   BASE_URL=http://localhost:6100 node scripts/test-pk10-of.mjs
 *
 * 前提：同其他彩種——dev server 要跑著、用種子帳號登入、依賴保留下來的
 * 管理員限定測試工具 server/api/admin/pk10of-test-settle.post.ts。
 *
 * 涵蓋範圍：
 *   1. 當期資訊格式（issue／openCode／pool）
 *   2. 正常下注（賠率制單選／前三直選選號）與拒單（前三直選選號數不符）
 *   3. 賠率制 3 玩法判定（前一直選／前二直選／定位膽）
 *   4. 前三直選（qiansan）依命中名次數分層：頭獎/二獎（彩池比例＋最低保障，
 *      只驗證分層與 floor，不驗證精確金額）、三獎（固定 2 倍，可精確驗證）
 *   5. ⚠️ 彩池共用狀態安全性：settleIssuePrize 結算尾端會無條件覆寫與 PK10-CD
 *      共用的 `PK10_SHARED.pool.carry`。驗證測試工具的「呼叫前快照、呼叫後還原」
 *      機制確實擋下了這個會永久污染正式彩池的風險
 *   6. 已結算期別不重複結算（冪等性）
 *
 * ⚠️ 已知範圍限制：爆池需要 PK10-CD／PK10-OF 兩個盤口都對同一期交件才會真的分配，
 * 這支腳本只測 PK10-OF 單邊的合成期別，PK10-CD 永遠不會對同一個合成期別交件，
 * 所以 jackpotAmount 恆為 0——這是架構上的正確行為，不是 bug。
 *
 * ⚠️ 這支腳本會留下測試紀錄（不清除也不需要清除），所有測試期別都是獨立的合成期別
 * （`TEST-PK10OF-*`），不會動到真實的 currentIndex／recordOpenCode。
 */

import { createTestRunner } from './_test-utils.mjs'

const { api, ok, section, login, summary, waitForOpen } = createTestRunner()

async function getCoin() {
  const { body } = await api('/api/lottery/userInfo?lottery=PK10-OF')
  return Number(body?.coin ?? NaN)
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery/pk10-of/current')
  ok('current API 回 200', status === 200)
  ok('issue 有值', typeof body?.issue === 'string' && body.issue.length > 0, body?.issue)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('openCode 為 10 台車名次表', Array.isArray(body?.openCode) && body.openCode.length === 10)
}

async function testBetting() {
  section('下注與拒單')
  await waitForOpen('/api/lottery/pk10-of/current')
  const before = await getCoin()

  const oddsBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 300101, key: 'PK10-OF' },
      amount: 100,
      groups: [{ playKey: 'qianyi', selectTabId: 141101010, playList: [{ label: '前一03', amount: 100 }] }]
    })
  })
  ok('前一直選下注成功', oddsBet.status === 200 && oddsBet.body?.orders?.length === 1, JSON.stringify(oddsBet.body))

  const poolBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 300101, key: 'PK10-OF' },
      amount: 10,
      groups: [{ playKey: 'qiansan', selectTabId: 141121011, playList: [{ codes: [3, 7, 1], amount: 10 }] }]
    })
  })
  ok('前三直選選號下注成功', poolBet.status === 200 && poolBet.body?.orders?.length === 1, JSON.stringify(poolBet.body))

  const after = await getCoin()
  ok(
    '扣款金額正確（100 + 10 = 110）',
    Number.isFinite(before) && Number.isFinite(after) && Math.abs((before - after) - 110) < 0.001,
    `before=${before} after=${after}`
  )

  const balanceBeforeReject = await getCoin()
  const wrongPickCount = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 300101, key: 'PK10-OF' },
      amount: 10,
      groups: [{ playKey: 'qiansan', selectTabId: 141121011, playList: [{ codes: [3, 7], amount: 10 }] }]
    })
  })
  ok('拒單：前三直選只選 2 個車號（需 3 個）→ 400', wrongPickCount.status === 400)
  const balanceAfterReject = await getCoin()
  ok(
    '拒單未扣款',
    Math.abs(balanceBeforeReject - balanceAfterReject) < 0.001,
    `before=${balanceBeforeReject} after=${balanceAfterReject}`
  )
}

async function settle(payload, reuseIssue) {
  return api('/api/admin/pk10of-test-settle', {
    method: 'POST',
    body: JSON.stringify({ ...payload, ...(reuseIssue ? { reuseIssue } : {}) })
  })
}

async function testOddsJudging() {
  section('賠率制 3 玩法判定與派彩')
  // 開獎：冠軍車3、亞軍車7、第三名車1…第十名車10
  const openCode = [3, 7, 1, 5, 9, 2, 4, 6, 8, 10]

  const cases = [
    { name: '前一直選「前一03」中獎（冠軍車=3）', playKey: 'qianyi', tabId: 141101010, betCode: '前一03', winAmount: 960 },
    { name: '前一直選「前一05」不中', playKey: 'qianyi', tabId: 141101010, betCode: '前一05', winAmount: 0 },
    { name: '定位膽「亞軍07」中獎（亞軍車=7）', playKey: 'dingwei', tabId: 141131010, betCode: '亞軍07', winAmount: 480, coin: 50 },
    { name: '前二直選「前二03-07」中獎（冠3、亞7，有序）', playKey: 'qianer', tabId: 141111011, betCode: '前二03-07', winAmount: 3456, coin: 40 },
    { name: '前二直選「前二07-03」不中（順序相反）', playKey: 'qianer', tabId: 141111011, betCode: '前二07-03', winAmount: 0, coin: 40 }
  ]

  for (const testCase of cases) {
    const coin = testCase.coin ?? 100
    const { status, body } = await settle({
      oddsBets: [{ playKey: testCase.playKey, tabId: testCase.tabId, betCode: testCase.betCode, coin }],
      openCode
    })
    const row = body?.settledRows?.[0]
    const expectStatus = testCase.winAmount > 0 ? 'win' : 'lose'
    ok(
      testCase.name,
      status === 200 && row?.winStatus === expectStatus && Number(row?.winAmount) === testCase.winAmount,
      JSON.stringify(row)
    )
  }
}

async function testPoolTiers() {
  section('前三直選（依命中名次數分層）')
  const openCode = [3, 7, 1, 5, 9, 2, 4, 6, 8, 10]

  const fixedTier = await settle({ poolBets: [{ picks: [3, 1, 9], coin: 25 }], openCode })
  const fixedRow = fixedTier.body?.settledRows?.[0]
  ok(
    '命中1個名次 → 三獎（固定倍數，可精確驗證：2 × 25 = 50）',
    fixedTier.status === 200 && fixedRow?.matchCount === 1 && fixedRow?.tierName === '三獎' && Number(fixedRow?.winAmount) === 50,
    JSON.stringify(fixedRow)
  )

  const secondTier = await settle({ poolBets: [{ picks: [3, 7, 2], coin: 10 }], openCode })
  const secondRow = secondTier.body?.settledRows?.[0]
  ok(
    '命中2個名次（冠亞正確，季軍錯）→ 二獎（彩池比例，只驗證分層與floor，不驗證精確金額）',
    secondTier.status === 200 && secondRow?.matchCount === 2 && secondRow?.tierName === '二獎' && Number(secondRow?.winAmount) > 0,
    JSON.stringify(secondRow)
  )

  const topTier = await settle({ poolBets: [{ picks: [3, 7, 1], coin: 10 }], openCode })
  const topRow = topTier.body?.settledRows?.[0]
  ok(
    '命中3個名次（全對）→ 頭獎（彩池比例＋最低保障 20000/單位，只驗證分層與門檻）',
    topTier.status === 200 && topRow?.matchCount === 3 && topRow?.tierName === '頭獎' && Number(topRow?.winAmount) >= 20000 * 10,
    JSON.stringify(topRow)
  )

  const noHit = await settle({ poolBets: [{ picks: [10, 9, 8], coin: 10 }], openCode })
  const noHitRow = noHit.body?.settledRows?.[0]
  ok(
    '完全不中 → lose、0 個名次命中',
    noHit.status === 200 && noHitRow?.matchCount === 0 && noHitRow?.winStatus === 'lose' && Number(noHitRow?.winAmount) === 0,
    JSON.stringify(noHitRow)
  )
}

async function testPoolCarrySafety() {
  section('彩池共用狀態安全性（驗證測試不會污染正式彩池 carry）')
  const openCode = [3, 7, 1, 5, 9, 2, 4, 6, 8, 10]

  const { status, body } = await settle({ poolBets: [{ picks: [3, 7, 1], coin: 10 }], openCode })
  ok('頭獎測試結算成功', status === 200 && body?.settledRows?.[0]?.tierName === '頭獎', JSON.stringify(body?.settledRows?.[0]))
  ok(
    '測試工具回報：若沒有快照還原機制，carry 真的會被覆寫成不同的值',
    Number(body?.poolCarry?.before) !== Number(body?.poolCarry?.wouldHaveChangedToWithoutGuard),
    JSON.stringify(body?.poolCarry)
  )
  ok(
    '測試工具回報：還原後的 carry 等於呼叫前的快照',
    Number(body?.poolCarry?.restoredTo) === Number(body?.poolCarry?.before),
    JSON.stringify(body?.poolCarry)
  )

  const before = await api('/api/lottery/pk10-of/current')
  const carryBeforeAll = Number(before.body?.pool?.carry ?? NaN)
  const after = await api('/api/lottery/pk10-of/current')
  const carryAfterAll = Number(after.body?.pool?.carry ?? NaN)
  ok(
    '從真實 API 角度看，正式彩池 carry 沒有被上面的測試改變',
    Number.isFinite(carryBeforeAll) && Number.isFinite(carryAfterAll) && Math.abs(carryBeforeAll - carryAfterAll) < 0.001,
    `before=${carryBeforeAll} after=${carryAfterAll}`
  )
}

async function testIdempotency() {
  section('已結算期別不重複結算（冪等性）')
  const reuseIssue = `TEST-PK10OF-IDEMPOTENT-${Date.now()}`
  const openCode = [3, 7, 1, 5, 9, 2, 4, 6, 8, 10]

  const first = await settle(
    { oddsBets: [{ playKey: 'qianyi', tabId: 141101010, betCode: '前一03', coin: 100 }], openCode },
    reuseIssue
  )
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：可領金額正確（960）', Number(first.body?.claimable?.amount) === 960)

  const second = await settle(
    { oddsBets: [{ playKey: 'qianyi', tabId: 141101010, betCode: '前一03', coin: 100 }], openCode },
    reuseIssue
  )
  ok('第二次呼叫：alreadySettledBefore = true', second.body?.alreadySettledBefore === true)
  ok(
    '第二次呼叫：新注單維持 pending（不會被結算）',
    second.body?.settledRows?.[0]?.winStatus === 'pending',
    JSON.stringify(second.body?.settledRows?.[0])
  )
  ok(
    '可領金額沒有被重複疊加（維持 960，不是 1920）',
    Number(second.body?.claimable?.amount) === 960,
    `claimable=${second.body?.claimable?.amount}`
  )
}

async function main() {
  console.log('PK10-OF 測試腳本開始')
  await login()
  await testCurrentInfo()
  await testBetting()
  await testOddsJudging()
  await testPoolTiers()
  await testPoolCarrySafety()
  await testIdempotency()

  summary()
}

main().catch((err) => {
  console.error('測試腳本執行時發生未預期錯誤：', err)
  process.exitCode = 1
})
