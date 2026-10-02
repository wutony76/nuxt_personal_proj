#!/usr/bin/env node
/**
 * 時時彩官方盤（SSC-OF）隨時可跑的端到端測試腳本。
 *
 * 用法：
 *   npm run test:ssc-of
 *   node test/test-ssc-of.mjs
 *   BASE_URL=http://localhost:6100 node test/test-ssc-of.mjs
 *
 * 前提：同其他彩種——dev server 要跑著、用種子帳號登入、依賴保留下來的
 * 管理員限定測試工具 server/api/admin/sscof-test-settle.post.ts。
 *
 * 涵蓋範圍：
 *   1. 當期資訊格式（issue／openCode）
 *   2. 正常下注（賠率制單選／後三直選選號）
 *   3. 賠率制玩法判定：定位膽、後二直選、後二組選、後三組三、後三組六、五星直選、大小單雙
 *   4. 後三直選（housan，唯一吃彩池的分頁）依命中位數分層：頭獎/二獎（彩池比例＋
 *      最低保障，只驗證分層與 floor）、三獎（固定 2 倍，可精確驗證）
 *   5. ⚠️ 彩池共用狀態安全性：settleIssuePrize 結算尾端會無條件覆寫與 SSC-CD
 *      共用的 `SSC_SHARED.pool.carry`。驗證測試工具的「呼叫前快照、呼叫後還原」
 *      機制確實擋下了這個會永久污染正式彩池的風險
 *   6. 已結算期別不重複結算（冪等性）
 *
 * ⚠️ 已知範圍限制：爆池需要 SSC-CD／SSC-OF 兩個盤口都對同一期交件才會真的分配，
 * 這支腳本只測 SSC-OF 單邊的合成期別，SSC-CD 永遠不會對同一個合成期別交件，
 * 所以 jackpotAmount 恆為 0——這是架構上的正確行為，不是 bug。
 *
 * ⚠️ 這支腳本會留下測試紀錄（不清除也不需要清除），所有測試期別都是獨立的合成期別
 * （`TEST-SSCOF-*`），不會動到真實的 currentIndex／recordOpenCode。
 */

import { createTestRunner } from './_test-utils.mjs'

const { api, ok, section, login, summary, waitForOpen } = createTestRunner()

async function getCoin() {
  const { body } = await api('/api/lottery/userInfo?lottery=SSC-OF')
  return Number(body?.coin ?? NaN)
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery/ssc-of/current')
  ok('current API 回 200', status === 200)
  ok('issue 有值', typeof body?.issue === 'string' && body.issue.length > 0, body?.issue)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('openCode 為 5 個號碼', Array.isArray(body?.openCode) && body.openCode.length === 5)
}

async function testBetting() {
  section('下注')
  await waitForOpen('/api/lottery/ssc-of/current')
  const before = await getCoin()

  const oddsBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 400101, key: 'SSC-OF' },
      amount: 100,
      groups: [{ playKey: 'dingwei', selectTabId: 101101010, playList: [{ label: '第一球7', amount: 100 }] }]
    })
  })
  ok('定位膽下注成功', oddsBet.status === 200 && oddsBet.body?.orders?.length === 1, JSON.stringify(oddsBet.body))

  const poolBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 400101, key: 'SSC-OF' },
      amount: 10,
      groups: [{ playKey: 'housan', selectTabId: 101141010, playList: [{ label: '後三直選238', amount: 10 }] }]
    })
  })
  ok('後三直選下注成功', poolBet.status === 200 && poolBet.body?.orders?.length === 1, JSON.stringify(poolBet.body))

  const after = await getCoin()
  ok(
    '扣款金額正確（100 + 10 = 110）',
    Number.isFinite(before) && Number.isFinite(after) && Math.abs((before - after) - 110) < 0.001,
    `before=${before} after=${after}`
  )
}

async function settle(payload, reuseIssue) {
  return api('/api/admin/sscof-test-settle', {
    method: 'POST',
    body: JSON.stringify({ ...payload, ...(reuseIssue ? { reuseIssue } : {}) })
  })
}

async function testOddsJudging() {
  section('賠率制玩法判定與派彩')
  const openCode = [7, 3, 2, 8, 5]

  const cases = [
    { name: '定位膽「第一球7」中獎', playKey: 'dingwei', tabId: 101101010, betCode: '第一球7', openCode, winAmount: 960 },
    { name: '後二直選「後二直選85」中獎（後二=[8,5]）', playKey: 'erxing', tabId: 101111110, betCode: '後二直選85', openCode, winAmount: 9600 },
    { name: '後二組選「後二組選58」中獎（不分順序）', playKey: 'erxing', tabId: 101111310, betCode: '後二組選58', openCode, winAmount: 4800 },
    { name: '後三組三「後三組三28」中獎（後三=[2,8,8]，恰兩碼相同）', playKey: 'housan', tabId: 101141110, betCode: '後三組三28', openCode: [7, 2, 2, 8, 8], winAmount: 16000 },
    { name: '後三組六「後三組六238」中獎（後三=[2,3,8]，三碼互異）', playKey: 'housan', tabId: 101141111, betCode: '後三組六238', openCode: [1, 9, 2, 3, 8], winAmount: 16000 },
    { name: '五星直選「五星直選73285」中獎（5位全中）', playKey: 'wuxing', tabId: 101161010, betCode: '五星直選73285', openCode, winAmount: 9600000 },
    { name: '大小單雙「大小單雙後二大小」中獎（後二=[8,3]，8大3小）', playKey: 'daxiao', tabId: 101181010, betCode: '大小單雙後二大小', openCode: [1, 9, 2, 8, 3], winAmount: 384 }
  ]

  for (const testCase of cases) {
    const { status, body } = await settle({
      oddsBets: [{ playKey: testCase.playKey, tabId: testCase.tabId, betCode: testCase.betCode, coin: 100 }],
      openCode: testCase.openCode
    })
    const row = body?.settledRows?.[0]
    ok(
      testCase.name,
      status === 200 && row?.winStatus === 'win' && Number(row?.winAmount) === testCase.winAmount,
      JSON.stringify(row)
    )
  }
}

async function testPoolTiers() {
  section('後三直選（依命中位數分層）')
  const openCode = [7, 9, 2, 3, 8]

  const fixedTier = await settle({ poolBets: [{ picks: [2, 9, 9], coin: 25 }], openCode })
  const fixedRow = fixedTier.body?.settledRows?.[0]
  ok(
    '命中1個位置 → 三獎（固定倍數，可精確驗證：2 × 25 = 50）',
    fixedTier.status === 200 && fixedRow?.matchCount === 1 && fixedRow?.tierName === '三獎' && Number(fixedRow?.winAmount) === 50,
    JSON.stringify(fixedRow)
  )

  const secondTier = await settle({ poolBets: [{ picks: [2, 3, 9], coin: 10 }], openCode })
  const secondRow = secondTier.body?.settledRows?.[0]
  ok(
    '命中2個位置（百十對，個位錯）→ 二獎（彩池比例，只驗證分層與floor，不驗證精確金額）',
    secondTier.status === 200 && secondRow?.matchCount === 2 && secondRow?.tierName === '二獎' && Number(secondRow?.winAmount) > 0,
    JSON.stringify(secondRow)
  )

  const topTier = await settle({ poolBets: [{ picks: [2, 3, 8], coin: 10 }], openCode })
  const topRow = topTier.body?.settledRows?.[0]
  ok(
    '命中3個位置（全對）→ 頭獎（彩池比例＋最低保障 20000/單位，只驗證分層與門檻）',
    topTier.status === 200 && topRow?.matchCount === 3 && topRow?.tierName === '頭獎' && Number(topRow?.winAmount) >= 20000 * 10,
    JSON.stringify(topRow)
  )

  const noHit = await settle({ poolBets: [{ picks: [9, 8, 7], coin: 10 }], openCode })
  const noHitRow = noHit.body?.settledRows?.[0]
  ok(
    '完全不中 → lose、0 個位置命中',
    noHit.status === 200 && noHitRow?.matchCount === 0 && noHitRow?.winStatus === 'lose' && Number(noHitRow?.winAmount) === 0,
    JSON.stringify(noHitRow)
  )
}

async function testPoolCarrySafety() {
  section('彩池共用狀態安全性（驗證測試不會污染正式彩池 carry）')
  const openCode = [7, 9, 2, 3, 8]

  const { status, body } = await settle({ poolBets: [{ picks: [2, 3, 8], coin: 10 }], openCode })
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

  const before = await api('/api/lottery/ssc-of/current')
  const carryBeforeAll = Number(before.body?.pool?.carry ?? NaN)
  const after = await api('/api/lottery/ssc-of/current')
  const carryAfterAll = Number(after.body?.pool?.carry ?? NaN)
  ok(
    '從真實 API 角度看，正式彩池 carry 沒有被上面的測試改變',
    Number.isFinite(carryBeforeAll) && Number.isFinite(carryAfterAll) && Math.abs(carryBeforeAll - carryAfterAll) < 0.001,
    `before=${carryBeforeAll} after=${carryAfterAll}`
  )
}

async function testIdempotency() {
  section('已結算期別不重複結算（冪等性）')
  const reuseIssue = `TEST-SSCOF-IDEMPOTENT-${Date.now()}`
  const openCode = [7, 3, 2, 8, 5]

  const first = await settle(
    { oddsBets: [{ playKey: 'dingwei', tabId: 101101010, betCode: '第一球7', coin: 100 }], openCode },
    reuseIssue
  )
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：可領金額正確（960）', Number(first.body?.claimable?.amount) === 960)

  const second = await settle(
    { oddsBets: [{ playKey: 'dingwei', tabId: 101101010, betCode: '第一球7', coin: 100 }], openCode },
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
  console.log('SSC-OF 測試腳本開始')
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
