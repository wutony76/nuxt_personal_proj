#!/usr/bin/env node
/**
 * 快3官方盤（K3-OF）隨時可跑的端到端測試腳本。
 *
 * 用法：
 *   npm run test:k3-of
 *   node scripts/test-k3-of.mjs
 *   BASE_URL=http://localhost:6100 node scripts/test-k3-of.mjs
 *
 * 前提：同 test-k3-cd.mjs——dev server 要跑著、用種子帳號登入、依賴保留下來的
 * 管理員限定測試工具 server/api/admin/k3of-test-settle.post.ts。
 *
 * 涵蓋範圍：
 *   1. 當期資訊格式（issueCurrent／pool／currentStatus，pool 與 K3-CD 共用同一份）
 *   2. 正常下注（賠率制單注／彩池選號注／同時混合兩種）與餘額扣款
 *   3. 拒單情境（不存在的注碼／選號格式不合／低於單注下限）且確認未扣款
 *   4. 賠率制 6 玩法判定與派彩：和值、大小單雙（含圍骰 tie）、三同號（通選＋單選）、
 *      三不同號、三連號、二同號（複選＋單選）、二不同號
 *   5. 彩池選號玩法（xuanhao）依命中顆數分層：頭獎（彩池比例＋最低保障）、
 *      二獎（純比例）、三獎（固定倍數，可精確驗證金額）
 *   6. ⚠️ 彩池共用狀態安全性：K3-OF 的 settleIssuePrize 尾端會無條件覆寫共用的
 *      `K3_SHARED.pool.carry`（滾存），測試工具用「呼叫前存快照、呼叫後立刻還原」
 *      防止測試污染正式彩池——這裡直接驗證 carry 在測試前後維持不變
 *   7. 已結算期別不重複結算（冪等性，跟 K3-CD 同一套 guard 模式）
 *
 * ⚠️ 已知範圍限制：爆池（K3_JACKPOT）需要 K3-CD／K3-OF 兩個盤口對同一期都交件才會真的
 * 分配，這支腳本只測 K3-OF 單邊的合成期別，K3-CD 永遠不會對同一個合成期別交件，所以
 * jackpotAmount 恆為 0——這是架構上的正確行為，不是 bug，跟 test-k3-cd.mjs 的已知限制一樣。
 *
 * ⚠️ 這支腳本會留下測試紀錄（不清除也不需要清除），所有測試期別都是獨立的合成期別
 * （`TEST-K3OF-*`），不會動到真實的 currentIndex／recordOpenCode。
 */

import { createTestRunner } from './_test-utils.mjs'

const { api, ok, section, login, summary } = createTestRunner()

async function getCoin() {
  const { body } = await api('/api/lottery/userInfo?lottery=K3-OF')
  return Number(body?.coin ?? NaN)
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery/k3-of/current')
  ok('current API 回 200', status === 200)
  ok('issueCurrent 有值', typeof body?.issueCurrent === 'string' && body.issueCurrent.length > 0, body?.issueCurrent)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('pool 欄位存在（與 K3-CD 共用同一份彩池）', body?.pool && typeof body.pool === 'object')
}

async function testBetting() {
  section('下注與拒單')
  const before = await getCoin()

  const oddsBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 200101, key: 'K3-OF' },
      amount: 100,
      groups: [{
        playKey: 'hezhi', playTypeName: '和值', selectTabId: 50000,
        playList: [{ label: '和10', amount: 100 }]
      }]
    })
  })
  ok('賠率制單注下注成功', oddsBet.status === 200 && oddsBet.body?.orders?.length === 1, JSON.stringify(oddsBet.body))

  const poolBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 200101, key: 'K3-OF' },
      amount: 200,
      groups: [{
        playKey: 'xuanhao', playTypeName: '選號',
        playList: [{ codes: [1, 2, 3], amount: 100 }, { codes: [4, 4, 6], amount: 100 }]
      }]
    })
  })
  ok('彩池選號下注成功（兩注）', poolBet.status === 200 && poolBet.body?.orders?.length === 2, JSON.stringify(poolBet.body))

  const mixedBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 200101, key: 'K3-OF' },
      amount: 300,
      groups: [
        { playKey: 'santong', selectTabId: 50002, playList: [{ label: '三同3', amount: 100 }] },
        { playKey: 'xuanhao', playList: [{ codes: [2, 3, 5], amount: 200 }] }
      ]
    })
  })
  ok('混合下注成功（賠率制＋彩池各一注）', mixedBet.status === 200 && mixedBet.body?.orders?.length === 2, JSON.stringify(mixedBet.body))

  const afterGoodBets = await getCoin()
  ok(
    '扣款金額正確（100 + 200 + 300 = 600）',
    Number.isFinite(before) && Number.isFinite(afterGoodBets) && Math.abs((before - afterGoodBets) - 600) < 0.001,
    `before=${before} after=${afterGoodBets}`
  )

  const balanceBeforeRejects = await getCoin()

  const invalidCode = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 200101, key: 'K3-OF' },
      amount: 100,
      groups: [{ playKey: 'hezhi', selectTabId: 50000, playList: [{ label: '和20', amount: 100 }] }]
    })
  })
  ok('拒單：和值超出範圍（和20）→ 400', invalidCode.status === 400)

  const invalidPicks = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 200101, key: 'K3-OF' },
      amount: 100,
      groups: [{ playKey: 'xuanhao', playList: [{ codes: [1, 2], amount: 100 }] }]
    })
  })
  ok('拒單：選號玩法只選 2 個點數 → 400', invalidPicks.status === 400)

  const belowMin = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 200101, key: 'K3-OF' },
      amount: 1,
      groups: [{ playKey: 'hezhi', selectTabId: 50000, playList: [{ label: '和10', amount: 1 }] }]
    })
  })
  ok('拒單：單注低於下限 → 400', belowMin.status === 400)

  const balanceAfterRejects = await getCoin()
  ok(
    '三種拒單情境皆未扣款',
    Math.abs(balanceBeforeRejects - balanceAfterRejects) < 0.001,
    `before=${balanceBeforeRejects} after=${balanceAfterRejects}`
  )
}

async function settle(payload, reuseIssue) {
  return api('/api/admin/k3of-test-settle', {
    method: 'POST',
    body: JSON.stringify({ ...payload, ...(reuseIssue ? { reuseIssue } : {}) })
  })
}

async function testOddsJudging() {
  section('賠率制 6 玩法判定與派彩（含圍骰 tie 邊界）')

  const cases = [
    { name: '和10 中獎（sum=10）', playKey: 'hezhi', tabId: 50000, betCode: '和10', openCode: [3, 3, 4], winStatus: 'win', winAmount: 776 },
    { name: '和10 不中（sum=6）', playKey: 'hezhi', tabId: 50000, betCode: '和10', openCode: [1, 2, 3], winStatus: 'lose', winAmount: 0 },
    { name: '大 中獎（sum=15）', playKey: 'hezhi', tabId: 50000, betCode: '大', openCode: [4, 5, 6], winStatus: 'win', winAmount: 194 },
    { name: '大 開圍骰 → 和局退本金', playKey: 'hezhi', tabId: 50000, betCode: '大', openCode: [2, 2, 2], winStatus: 'tie', winAmount: 100 },
    { name: '三同通選 中獎（任一圍骰）', playKey: 'santong', tabId: 50001, betCode: '三同通選', openCode: [5, 5, 5], winStatus: 'win', winAmount: 3492 },
    { name: '三同3 中獎（恰好333）', playKey: 'santong', tabId: 50002, betCode: '三同3', openCode: [3, 3, 3], winStatus: 'win', winAmount: 20952 },
    { name: '三同3 不中（開111）', playKey: 'santong', tabId: 50002, betCode: '三同3', openCode: [1, 1, 1], winStatus: 'lose', winAmount: 0 },
    { name: '三不同123 中獎（恰為123）', playKey: 'sanbutong', tabId: 50006, betCode: '三不同123', openCode: [1, 2, 3], winStatus: 'win', winAmount: 3492 },
    { name: '三不同123 不中（124）', playKey: 'sanbutong', tabId: 50006, betCode: '三不同123', openCode: [1, 2, 4], winStatus: 'lose', winAmount: 0 },
    { name: '三連通選 中獎（234 連號）', playKey: 'sanlian', tabId: 50003, betCode: '三連通選', openCode: [2, 3, 4], winStatus: 'win', winAmount: 873 },
    { name: '三連通選 不中（124 非連號）', playKey: 'sanlian', tabId: 50003, betCode: '三連通選', openCode: [1, 2, 4], winStatus: 'lose', winAmount: 0 },
    { name: '二同複1 中獎（恰兩顆1）', playKey: 'ertong', tabId: 50004, betCode: '二同複1', openCode: [1, 1, 5], winStatus: 'win', winAmount: 1397 },
    { name: '二同複1 不中（開111，三顆不算恰兩顆）', playKey: 'ertong', tabId: 50004, betCode: '二同複1', openCode: [1, 1, 1], winStatus: 'lose', winAmount: 0 },
    { name: '二同1-2 中獎（對1＋單張2）', playKey: 'ertong', tabId: 50005, betCode: '二同1-2', openCode: [1, 1, 2], winStatus: 'win', winAmount: 6984 },
    { name: '二同1-2 不中（對1＋單張3）', playKey: 'ertong', tabId: 50005, betCode: '二同1-2', openCode: [1, 1, 3], winStatus: 'lose', winAmount: 0 },
    { name: '二不同12 中獎（1、2都出現）', playKey: 'erbutong', tabId: 50008, betCode: '二不同12', openCode: [1, 2, 5], winStatus: 'win', winAmount: 698 },
    { name: '二不同12 不中（缺2）', playKey: 'erbutong', tabId: 50008, betCode: '二不同12', openCode: [1, 3, 5], winStatus: 'lose', winAmount: 0 }
  ]

  for (const testCase of cases) {
    const { status, body } = await settle({
      oddsBets: [{ playKey: testCase.playKey, tabId: testCase.tabId, betCode: testCase.betCode, coin: 100 }],
      openCode: testCase.openCode
    })
    const row = body?.settledRows?.[0]
    ok(
      testCase.name,
      status === 200 && row?.winStatus === testCase.winStatus && Number(row?.winAmount) === testCase.winAmount,
      JSON.stringify(row)
    )
  }
}

async function testPoolTiers() {
  section('彩池選號玩法（依命中顆數分層）')

  const fixedTier = await settle({
    poolBets: [{ picks: [1, 3, 4], coin: 100 }],
    openCode: [1, 2, 5]
  })
  const fixedRow = fixedTier.body?.settledRows?.[0]
  ok(
    '命中1顆 → 三獎（固定倍數，可精確驗證：2 × 100 = 200）',
    fixedTier.status === 200 && fixedRow?.matchCount === 1 && fixedRow?.tierName === '三獎' && Number(fixedRow?.winAmount) === 200,
    JSON.stringify(fixedRow)
  )

  const secondTier = await settle({
    poolBets: [{ picks: [1, 2, 6], coin: 100 }],
    openCode: [1, 2, 5]
  })
  const secondRow = secondTier.body?.settledRows?.[0]
  ok(
    '命中2顆 → 二獎（彩池比例分配，只驗證分層與正派彩，不驗證精確金額——與即時彩池餘額有關）',
    secondTier.status === 200 && secondRow?.matchCount === 2 && secondRow?.tierName === '二獎' && Number(secondRow?.winAmount) > 0,
    JSON.stringify(secondRow)
  )

  const topTier = await settle({
    poolBets: [{ picks: [3, 3, 4], coin: 100 }],
    openCode: [3, 3, 4]
  })
  const topRow = topTier.body?.settledRows?.[0]
  ok(
    '命中3顆（全對）→ 頭獎（彩池比例＋最低保障 20000，只驗證分層與門檻，不驗證精確金額）',
    topTier.status === 200 && topRow?.matchCount === 3 && topRow?.tierName === '頭獎' && Number(topRow?.winAmount) >= 20000,
    JSON.stringify(topRow)
  )

  const noHit = await settle({
    poolBets: [{ picks: [6, 6, 6], coin: 100 }],
    openCode: [1, 2, 5]
  })
  const noHitRow = noHit.body?.settledRows?.[0]
  ok(
    '完全不中 → lose、0 顆命中',
    noHit.status === 200 && noHitRow?.matchCount === 0 && noHitRow?.winStatus === 'lose' && Number(noHitRow?.winAmount) === 0,
    JSON.stringify(noHitRow)
  )
}

async function testPoolCarrySafety() {
  section('彩池共用狀態安全性（驗證測試不會污染正式彩池 carry）')

  const before = await api('/api/lottery/k3-of/current')
  const carryBeforeAll = Number(before.body?.pool?.carry ?? NaN)

  // 故意用會大幅改變 carryNext 計算結果的頭獎命中，驗證測試工具的快照／還原機制
  const { status, body } = await settle({
    poolBets: [{ picks: [2, 2, 2], coin: 100 }],
    openCode: [2, 2, 2]
  })
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

  const after = await api('/api/lottery/k3-of/current')
  const carryAfterAll = Number(after.body?.pool?.carry ?? NaN)
  ok(
    '從真實 API 角度看，正式彩池 carry 在測試前後完全沒變',
    Number.isFinite(carryBeforeAll) && Number.isFinite(carryAfterAll) && Math.abs(carryBeforeAll - carryAfterAll) < 0.001,
    `before=${carryBeforeAll} after=${carryAfterAll}`
  )
}

async function testIdempotency() {
  section('已結算期別不重複結算（冪等性）')
  const reuseIssue = `TEST-K3OF-IDEMPOTENT-${Date.now()}`

  const first = await settle(
    { oddsBets: [{ playKey: 'santong', tabId: 50002, betCode: '三同3', coin: 100 }], openCode: [3, 3, 3] },
    reuseIssue
  )
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：可領金額正確（20952）', Number(first.body?.claimable?.amount) === 20952)

  const second = await settle(
    { oddsBets: [{ playKey: 'santong', tabId: 50002, betCode: '三同3', coin: 100 }], openCode: [3, 3, 3] },
    reuseIssue
  )
  ok('第二次呼叫：alreadySettledBefore = true', second.body?.alreadySettledBefore === true)
  ok(
    '第二次呼叫：新注單維持 pending（不會被結算）',
    second.body?.settledRows?.[0]?.winStatus === 'pending',
    JSON.stringify(second.body?.settledRows?.[0])
  )
  ok(
    '可領金額沒有被重複疊加（維持 20952，不是 41904）',
    Number(second.body?.claimable?.amount) === 20952,
    `claimable=${second.body?.claimable?.amount}`
  )
}

async function main() {
  console.log('K3-OF 測試腳本開始')
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
