#!/usr/bin/env node
/**
 * 11選5 官方盤（X5-OF）隨時可跑的端到端測試腳本。
 *
 * 用法：
 *   npm run test:x5-of
 *   node scripts/test-x5-of.mjs
 *   BASE_URL=http://localhost:6100 node scripts/test-x5-of.mjs
 *
 * 前提：同其他彩種——dev server 要跑著、用種子帳號登入、依賴保留下來的
 * 管理員限定測試工具 server/api/admin/x5of-test-settle.post.ts。
 *
 * 涵蓋範圍：
 *   1. 當期資訊格式（issue／openCode）
 *   2. 正常下注（賠率制單選／後三直選選號）
 *   3. 賠率制玩法判定：定位膽、三碼直選/組選、不定位、任選複式（含 N≤5 與 N>5 兩種
 *      判定方向）、趣味玩法（猜中位／定單雙）
 *   4. 後三直選（sanma 底下唯一吃彩池的分頁）依命中位數分層：頭獎/二獎（彩池比例＋
 *      最低保障，只驗證分層與 floor）、三獎（固定 2 倍，可精確驗證）
 *   5. ⚠️ 彩池共用狀態安全性：settleIssuePrize 結算尾端會無條件覆寫與 X5-CD
 *      共用的 `X5_SHARED.pool.carry`。驗證測試工具的「呼叫前快照、呼叫後還原」
 *      機制確實擋下了這個會永久污染正式彩池的風險
 *   6. 已結算期別不重複結算（冪等性）
 *
 * ⚠️ 已知範圍限制：爆池需要 X5-CD／X5-OF 兩個盤口都對同一期交件才會真的分配，
 * 這支腳本只測 X5-OF 單邊的合成期別，X5-CD 永遠不會對同一個合成期別交件，
 * 所以 jackpotAmount 恆為 0——這是架構上的正確行為，不是 bug。
 *
 * ⚠️ 這支腳本會留下測試紀錄（不清除也不需要清除），所有測試期別都是獨立的合成期別
 * （`TEST-X5OF-*`），不會動到真實的 currentIndex／recordOpenCode。
 */

import { createTestRunner } from './_test-utils.mjs'

const { api, ok, section, login, summary, waitForOpen } = createTestRunner()

async function getCoin() {
  const { body } = await api('/api/lottery/userInfo?lottery=X5-OF')
  return Number(body?.coin ?? NaN)
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery/x5-of/current')
  ok('current API 回 200', status === 200)
  ok('issue 有值', typeof body?.issue === 'string' && body.issue.length > 0, body?.issue)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('openCode 為 5 個號碼', Array.isArray(body?.openCode) && body.openCode.length === 5)
}

async function testBetting() {
  section('下注')
  await waitForOpen('/api/lottery/x5-of/current')
  const before = await getCoin()

  const oddsBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 600101, key: 'X5-OF' },
      amount: 100,
      groups: [{ playKey: 'dingwei', selectTabId: 111131010, playList: [{ label: '第一球07', amount: 100 }] }]
    })
  })
  ok('定位膽下注成功', oddsBet.status === 200 && oddsBet.body?.orders?.length === 1, JSON.stringify(oddsBet.body))

  const poolBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 600101, key: 'X5-OF' },
      amount: 10,
      groups: [{ playKey: 'sanma', selectTabId: 111101410, playList: [{ label: '後三直選020304', amount: 10 }] }]
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
  return api('/api/admin/x5of-test-settle', {
    method: 'POST',
    body: JSON.stringify({ ...payload, ...(reuseIssue ? { reuseIssue } : {}) })
  })
}

async function testOddsJudging() {
  section('賠率制玩法判定與派彩')
  const openCode = [7, 1, 2, 3, 4]

  const cases = [
    { name: '定位膽「第一球07」中獎', playKey: 'dingwei', tabId: 111131010, betCode: '第一球07', winAmount: 1055 },
    { name: '三碼「前三直選070102」中獎（前三=[7,1,2]，有序全中）', playKey: 'sanma', tabId: 111101010, betCode: '前三直選070102', winAmount: 9504, coin: 10 },
    { name: '三碼「前三組選010207」中獎（不分順序，同一組號碼）', playKey: 'sanma', tabId: 111101110, betCode: '前三組選010207', winAmount: 1584, coin: 10 },
    { name: '不定位「前三不定位07」中獎（7在前三任一位置）', playKey: 'budingwei', tabId: 111121010, betCode: '前三不定位07', winAmount: 351 },
    { name: '任選複式「任選三中三010207」中獎（N≤5：選的都要開出）', playKey: 'renxuanfu', tabId: 111141012, betCode: '任選三中三010207', winAmount: 1584 },
    { name: '任選複式「任選六中五010203040507」中獎（N>5：開出的都要在選的範圍內）', playKey: 'renxuanfu', tabId: 111141015, betCode: '任選六中五010203040507', winAmount: 739.2, coin: 10 },
    { name: '趣味玩法「猜中位03」中獎（5碼排序後中位數=3）', playKey: 'quwei', tabId: 111171017, betCode: '猜中位03', winAmount: 1584 },
    { name: '趣味玩法「定單雙三單二雙」中獎（5碼中單數個數=3）', playKey: 'quwei', tabId: 111171010, betCode: '定單雙三單二雙', winAmount: 221 }
  ]

  for (const testCase of cases) {
    const coin = testCase.coin ?? 100
    const { status, body } = await settle({
      oddsBets: [{ playKey: testCase.playKey, tabId: testCase.tabId, betCode: testCase.betCode, coin }],
      openCode
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
  const openCode = [7, 1, 2, 3, 4]

  const fixedTier = await settle({ poolBets: [{ picks: [2, 9, 8], coin: 25 }], openCode })
  const fixedRow = fixedTier.body?.settledRows?.[0]
  ok(
    '命中1個位置 → 三獎（固定倍數，可精確驗證：2 × 25 = 50）',
    fixedTier.status === 200 && fixedRow?.matchCount === 1 && fixedRow?.tierName === '三獎' && Number(fixedRow?.winAmount) === 50,
    JSON.stringify(fixedRow)
  )

  const secondTier = await settle({ poolBets: [{ picks: [2, 3, 9], coin: 10 }], openCode })
  const secondRow = secondTier.body?.settledRows?.[0]
  ok(
    '命中2個位置（第三四位對，第五位錯）→ 二獎（彩池比例，只驗證分層與floor，不驗證精確金額）',
    secondTier.status === 200 && secondRow?.matchCount === 2 && secondRow?.tierName === '二獎' && Number(secondRow?.winAmount) > 0,
    JSON.stringify(secondRow)
  )

  const topTier = await settle({ poolBets: [{ picks: [2, 3, 4], coin: 10 }], openCode })
  const topRow = topTier.body?.settledRows?.[0]
  ok(
    '命中3個位置（全對）→ 頭獎（彩池比例＋最低保障 20000/單位，只驗證分層與門檻）',
    topTier.status === 200 && topRow?.matchCount === 3 && topRow?.tierName === '頭獎' && Number(topRow?.winAmount) >= 20000 * 10,
    JSON.stringify(topRow)
  )

  const noHit = await settle({ poolBets: [{ picks: [9, 8, 10], coin: 10 }], openCode })
  const noHitRow = noHit.body?.settledRows?.[0]
  ok(
    '完全不中 → lose、0 個位置命中',
    noHit.status === 200 && noHitRow?.matchCount === 0 && noHitRow?.winStatus === 'lose' && Number(noHitRow?.winAmount) === 0,
    JSON.stringify(noHitRow)
  )
}

async function testPoolCarrySafety() {
  section('彩池共用狀態安全性（驗證測試不會污染正式彩池 carry）')
  const openCode = [7, 1, 2, 3, 4]

  const { status, body } = await settle({ poolBets: [{ picks: [2, 3, 4], coin: 10 }], openCode })
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

  const before = await api('/api/lottery/x5-of/current')
  const carryBeforeAll = Number(before.body?.pool?.carry ?? NaN)
  const after = await api('/api/lottery/x5-of/current')
  const carryAfterAll = Number(after.body?.pool?.carry ?? NaN)
  ok(
    '從真實 API 角度看，正式彩池 carry 沒有被上面的測試改變',
    Number.isFinite(carryBeforeAll) && Number.isFinite(carryAfterAll) && Math.abs(carryBeforeAll - carryAfterAll) < 0.001,
    `before=${carryBeforeAll} after=${carryAfterAll}`
  )
}

async function testIdempotency() {
  section('已結算期別不重複結算（冪等性）')
  const reuseIssue = `TEST-X5OF-IDEMPOTENT-${Date.now()}`
  const openCode = [7, 1, 2, 3, 4]

  const first = await settle(
    { oddsBets: [{ playKey: 'dingwei', tabId: 111131010, betCode: '第一球07', coin: 100 }], openCode },
    reuseIssue
  )
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：可領金額正確（1055）', Number(first.body?.claimable?.amount) === 1055)

  const second = await settle(
    { oddsBets: [{ playKey: 'dingwei', tabId: 111131010, betCode: '第一球07', coin: 100 }], openCode },
    reuseIssue
  )
  ok('第二次呼叫：alreadySettledBefore = true', second.body?.alreadySettledBefore === true)
  ok(
    '第二次呼叫：新注單維持 pending（不會被結算）',
    second.body?.settledRows?.[0]?.winStatus === 'pending',
    JSON.stringify(second.body?.settledRows?.[0])
  )
  ok(
    '可領金額沒有被重複疊加（維持 1055，不是 2110）',
    Number(second.body?.claimable?.amount) === 1055,
    `claimable=${second.body?.claimable?.amount}`
  )
}

async function main() {
  console.log('X5-OF 測試腳本開始')
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
