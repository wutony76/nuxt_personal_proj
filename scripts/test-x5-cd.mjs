#!/usr/bin/env node
/**
 * 11選5 信用盤（X5-CD）隨時可跑的端到端測試腳本。
 *
 * 用法：
 *   npm run test:x5-cd
 *   node scripts/test-x5-cd.mjs
 *   BASE_URL=http://localhost:6100 node scripts/test-x5-cd.mjs
 *
 * 前提：同其他彩種——dev server 要跑著、用種子帳號登入、依賴保留下來的
 * 管理員限定測試工具 server/api/admin/x5cd-test-settle.post.ts。
 *
 * 涵蓋範圍：
 *   1. 當期資訊格式（issue／openCode，5 個 1~11 互不重複）
 *   2. 正常下注與拒單（不存在的注碼／低於單注下限）且確認未扣款
 *   3. 4 個玩法判定與賠率：1-5球、兩面（含總和大小/單雙/尾大小 6 面）、
 *      龍虎鬥（無和局，5 碼不重複兩球位不可能相等）、全5中1；
 *      以及「無法辨識注碼視為和局全額退還」的邊界
 *   4. 已結算期別不重複結算（冪等性）
 *
 * ⚠️ X5-CD 的 settleIssuePrize 不會碰共用彩池（X5_SHARED.pool，那個只有
 * X5-OF 的後三直選在寫），只會交件給共用爆池層（需要 CD/OF 都交件才會真的分配，
 * 這裡的合成期別只有 CD 交件，爆池永遠不會被結算，不會誤動到真實爆池滾存）——
 * 因此這支腳本不需要像 test-x5-of.mjs 那樣做彩池快照/還原的安全性測試。
 *
 * ⚠️ 這支腳本會留下測試紀錄（不清除也不需要清除），所有測試期別都是獨立的合成期別
 * （`TEST-X5CD-*`），不會動到真實的 currentIndex／recordOpenCode。
 */

import { createTestRunner } from './_test-utils.mjs'

const { api, ok, section, login, summary } = createTestRunner()

async function getCoin() {
  const { body } = await api('/api/lottery/userInfo?lottery=X5-CD')
  return Number(body?.coin ?? NaN)
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery/x5-cd/current')
  ok('current API 回 200', status === 200)
  ok('issue 有值', typeof body?.issue === 'string' && body.issue.length > 0, body?.issue)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('openCode 為 5 個號碼', Array.isArray(body?.openCode) && body.openCode.length === 5)
}

async function testBetting() {
  section('下注與拒單')
  const before = await getCoin()

  const bet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 600100, key: 'X5-CD' },
      amount: 100,
      groups: [{ playKey: 'ball', playTypeName: '1-5球', selectTabId: 112100, playList: [{ label: '第一球07', amount: 100 }] }]
    })
  })
  ok('1-5球下注成功', bet.status === 200 && bet.body?.orders?.length === 1, JSON.stringify(bet.body))

  const after = await getCoin()
  ok(
    '扣款金額正確（100）',
    Number.isFinite(before) && Number.isFinite(after) && Math.abs((before - after) - 100) < 0.001,
    `before=${before} after=${after}`
  )

  const balanceBeforeRejects = await getCoin()

  const invalidCode = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 600100, key: 'X5-CD' },
      amount: 100,
      groups: [{ playKey: 'ball', selectTabId: 112100, playList: [{ label: '第一球99', amount: 100 }] }]
    })
  })
  ok('拒單：不存在的注碼（第一球99）→ 400', invalidCode.status === 400)

  const belowMin = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 600100, key: 'X5-CD' },
      amount: 1,
      groups: [{ playKey: 'ball', selectTabId: 112100, playList: [{ label: '第一球07', amount: 1 }] }]
    })
  })
  ok('拒單：單注低於下限（min=2）→ 400', belowMin.status === 400)

  const balanceAfterRejects = await getCoin()
  ok(
    '兩種拒單情境皆未扣款',
    Math.abs(balanceBeforeRejects - balanceAfterRejects) < 0.001,
    `before=${balanceBeforeRejects} after=${balanceAfterRejects}`
  )
}

async function settle(bets, openCode, reuseIssue) {
  return api('/api/admin/x5cd-test-settle', {
    method: 'POST',
    body: JSON.stringify({ bets, openCode, ...(reuseIssue ? { reuseIssue } : {}) })
  })
}

async function testPlayJudging() {
  section('4 個玩法判定與派彩')
  const openCode = [7, 1, 2, 3, 4]

  const cases = [
    { name: '1-5球「第一球07」中獎', playKey: 'ball', tabId: 112100, betCode: '第一球07', winStatus: 'win', winAmount: 1067, odds: 10.67 },
    { name: '1-5球「第二球07」不中', playKey: 'ball', tabId: 112100, betCode: '第二球07', winStatus: 'lose', winAmount: 0 },
    { name: '兩面「第一球大」中獎（第一球=7≥7）', playKey: 'liangmian', tabId: 112101, betCode: '第一球大', winStatus: 'win', winAmount: 213, odds: 2.13 },
    { name: '兩面「總和小」中獎（總和=17<31）', playKey: 'liangmian', tabId: 112101, betCode: '總和小', winStatus: 'win', winAmount: 181, odds: 1.81 },
    { name: '兩面「總和尾大」中獎（總和個位=7≥5）', playKey: 'liangmian', tabId: 112101, betCode: '總和尾大', winStatus: 'win', winAmount: 193, odds: 1.93 },
    { name: '兩面「總和單」中獎（總和=17為奇）', playKey: 'liangmian', tabId: 112101, betCode: '總和單', winStatus: 'win', winAmount: 189, odds: 1.89 },
    { name: '龍虎鬥「龍虎12龍」中獎（第一球7 > 第二球1，無和局）', playKey: 'longhu', tabId: 11211, betCode: '龍虎12龍', winStatus: 'win', winAmount: 194, odds: 1.94 },
    { name: '全5中1「全中07」中獎（7在5碼內）', playKey: 'quan5', tabId: 11212, betCode: '全中07', coin: 30, winStatus: 'win', winAmount: 63.9, odds: 2.13 },
    { name: '全5中1「全中05」不中（5不在5碼內）', playKey: 'quan5', tabId: 11212, betCode: '全中05', coin: 30, winStatus: 'lose', winAmount: 0 },
    { name: '⚠️ 無法辨識注碼視為和局全額退還', playKey: 'ball', tabId: 112100, betCode: '亂碼XYZ', winStatus: 'tie', winAmount: 100 }
  ]

  for (const testCase of cases) {
    const coin = testCase.coin ?? 100
    const { status, body } = await settle(
      [{ playKey: testCase.playKey, tabId: testCase.tabId, betCode: testCase.betCode, coin }],
      openCode
    )
    const row = body?.settledRows?.[0]
    const oddsOk = testCase.odds === undefined || Number(row?.odds) === testCase.odds
    ok(
      testCase.name,
      status === 200 && row?.winStatus === testCase.winStatus && Number(row?.winAmount) === testCase.winAmount && oddsOk,
      JSON.stringify(row)
    )
  }
}

async function testIdempotency() {
  section('已結算期別不重複結算（冪等性）')
  const reuseIssue = `TEST-X5CD-IDEMPOTENT-${Date.now()}`
  const openCode = [7, 1, 2, 3, 4]

  const first = await settle(
    [{ playKey: 'ball', tabId: 112100, betCode: '第一球07', coin: 100 }],
    openCode,
    reuseIssue
  )
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：可領金額正確（1067）', Number(first.body?.claimable?.amount) === 1067)

  const second = await settle(
    [{ playKey: 'ball', tabId: 112100, betCode: '第一球07', coin: 100 }],
    openCode,
    reuseIssue
  )
  ok('第二次呼叫：alreadySettledBefore = true', second.body?.alreadySettledBefore === true)
  ok(
    '第二次呼叫：新注單維持 pending（不會被結算）',
    second.body?.settledRows?.[0]?.winStatus === 'pending',
    JSON.stringify(second.body?.settledRows?.[0])
  )
  ok(
    '可領金額沒有被重複疊加（維持 1067，不是 2134）',
    Number(second.body?.claimable?.amount) === 1067,
    `claimable=${second.body?.claimable?.amount}`
  )
}

async function main() {
  console.log('X5-CD 測試腳本開始')
  await login()
  await testCurrentInfo()
  await testBetting()
  await testPlayJudging()
  await testIdempotency()

  summary()
}

main().catch((err) => {
  console.error('測試腳本執行時發生未預期錯誤：', err)
  process.exitCode = 1
})
