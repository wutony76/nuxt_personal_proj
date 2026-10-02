#!/usr/bin/env node
/**
 * 時時彩信用盤（SSC-CD）隨時可跑的端到端測試腳本。
 *
 * 用法：
 *   npm run test:ssc-cd
 *   node test/test-ssc-cd.mjs
 *   BASE_URL=http://localhost:6100 node test/test-ssc-cd.mjs
 *
 * 前提：同其他彩種——dev server 要跑著、用種子帳號登入、依賴保留下來的
 * 管理員限定測試工具 server/api/admin/ssccd-test-settle.post.ts。
 *
 * 涵蓋範圍：
 *   1. 當期資訊格式（issue／openCode，5 個 0~9 可重複）
 *   2. 正常下注與拒單（不存在的注碼／低於單注下限）且確認未扣款
 *   3. 7 個玩法判定與賠率：1-5球、兩面、前中後三（含豹子/半順牌型）、全5中1、
 *      龍虎鬥（含「和」是獨立注項、不是退款機制）、鬥牛、梭哈；
 *      以及「無法辨識注碼視為和局全額退還」的邊界（SSC 沒有真正的和局，
 *      tie 只用在無效注碼的防禦性退款——跟龍虎鬥的「和」是完全不同的兩件事）
 *   4. 已結算期別不重複結算（冪等性）
 *
 * ⚠️ SSC-CD 的 settleIssuePrize 不會碰共用彩池（SSC_SHARED.pool，那個只有
 * SSC-OF 的後三直選在寫），只會交件給共用爆池層（需要 CD/OF 都交件才會真的分配，
 * 這裡的合成期別只有 CD 交件，爆池永遠不會被結算，不會誤動到真實爆池滾存）——
 * 因此這支腳本不需要像 test-ssc-of.mjs 那樣做彩池快照/還原的安全性測試。
 *
 * ⚠️ 這支腳本會留下測試紀錄（不清除也不需要清除），所有測試期別都是獨立的合成期別
 * （`TEST-SSCCD-*`），不會動到真實的 currentIndex／recordOpenCode。
 */

import { createTestRunner } from './_test-utils.mjs'

const { api, ok, section, login, summary, waitForOpen } = createTestRunner()

async function getCoin() {
  const { body } = await api('/api/lottery/userInfo?lottery=SSC-CD')
  return Number(body?.coin ?? NaN)
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery/ssc-cd/current')
  ok('current API 回 200', status === 200)
  ok('issue 有值', typeof body?.issue === 'string' && body.issue.length > 0, body?.issue)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('openCode 為 5 個號碼', Array.isArray(body?.openCode) && body.openCode.length === 5)
}

async function testBetting() {
  section('下注與拒單')
  await waitForOpen('/api/lottery/ssc-cd/current')
  const before = await getCoin()

  const bet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 400100, key: 'SSC-CD' },
      amount: 100,
      groups: [{ playKey: 'ball', playTypeName: '1-5球', selectTabId: 10110, playList: [{ label: '第一球7', amount: 100 }] }]
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
      lottery: { id: 400100, key: 'SSC-CD' },
      amount: 100,
      groups: [{ playKey: 'ball', selectTabId: 10110, playList: [{ label: '第一球99', amount: 100 }] }]
    })
  })
  ok('拒單：不存在的注碼（第一球99）→ 400', invalidCode.status === 400)

  const belowMin = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 400100, key: 'SSC-CD' },
      amount: 1,
      groups: [{ playKey: 'ball', selectTabId: 10110, playList: [{ label: '第一球7', amount: 1 }] }]
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
  return api('/api/admin/ssccd-test-settle', {
    method: 'POST',
    body: JSON.stringify({ bets, openCode, ...(reuseIssue ? { reuseIssue } : {}) })
  })
}

async function testPlayJudging() {
  section('7 個玩法判定與派彩')

  const cases = [
    { name: '1-5球「第一球7」中獎', playKey: 'ball', tabId: 10110, betCode: '第一球7', openCode: [7, 3, 2, 8, 5], winStatus: 'win', winAmount: 969, odds: 9.69 },
    { name: '1-5球「第一球3」不中', playKey: 'ball', tabId: 10110, betCode: '第一球3', openCode: [7, 3, 2, 8, 5], winStatus: 'lose', winAmount: 0 },
    { name: '兩面「總和大」中獎（總和=25≥23）', playKey: 'liangmian', tabId: 10123, betCode: '總和大', openCode: [7, 3, 2, 8, 5], winStatus: 'win', winAmount: 194, odds: 1.94 },
    { name: '前中後三「前三半順」中獎（前三=[7,3,2]，兩碼相鄰）', playKey: 'sanpai', tabId: 10124, betCode: '前三半順', openCode: [7, 3, 2, 8, 5], winStatus: 'win', winAmount: 288, odds: 2.88 },
    { name: '前中後三「前三豹子」中獎（前三=[5,5,5]）', playKey: 'sanpai', tabId: 10124, betCode: '前三豹子', openCode: [5, 5, 5, 8, 5], winStatus: 'win', winAmount: 9700, odds: 97 },
    { name: '全5中1「全中5」中獎（任一球開出5）', playKey: 'quan5', tabId: 10125, betCode: '全中5', openCode: [7, 3, 2, 8, 5], winStatus: 'win', winAmount: 236, odds: 2.36 },
    { name: '龍虎鬥「龍虎12龍」中獎（第一球7 > 第二球3）', playKey: 'longhu', tabId: 10126, betCode: '龍虎12龍', openCode: [7, 3, 2, 8, 5], winStatus: 'win', winAmount: 215, odds: 2.15 },
    { name: '龍虎鬥「龍虎12和」中獎（第一球=第二球=4，「和」是獨立注項不是退款）', playKey: 'longhu', tabId: 10126, betCode: '龍虎12和', openCode: [4, 4, 2, 8, 5], winStatus: 'win', winAmount: 969, odds: 9.69 },
    { name: '鬥牛「牛5」中獎', playKey: 'douniu', tabId: 10127, betCode: '牛5', openCode: [7, 3, 2, 8, 5], winStatus: 'win', winAmount: 1521, odds: 15.21 },
    { name: '鬥牛「沒牛」中獎（湊不出10的倍數）', playKey: 'douniu', tabId: 10127, betCode: '沒牛', openCode: [1, 2, 4, 8, 9], winStatus: 'win', winAmount: 272, odds: 2.72 },
    { name: '梭哈「梭哈散號」中獎（5碼全異且不連號）', playKey: 'suoha', tabId: 10128, betCode: '梭哈散號', openCode: [7, 3, 2, 8, 5], winStatus: 'win', winAmount: 328, odds: 3.28 },
    { name: '⚠️ 無法辨識注碼視為和局全額退還', playKey: 'ball', tabId: 10110, betCode: '亂碼XYZ', openCode: [7, 3, 2, 8, 5], winStatus: 'tie', winAmount: 100 }
  ]

  for (const testCase of cases) {
    const { status, body } = await settle(
      [{ playKey: testCase.playKey, tabId: testCase.tabId, betCode: testCase.betCode, coin: 100 }],
      testCase.openCode
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
  const reuseIssue = `TEST-SSCCD-IDEMPOTENT-${Date.now()}`
  const openCode = [7, 3, 2, 8, 5]

  const first = await settle(
    [{ playKey: 'ball', tabId: 10110, betCode: '第一球7', coin: 100 }],
    openCode,
    reuseIssue
  )
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：可領金額正確（969）', Number(first.body?.claimable?.amount) === 969)

  const second = await settle(
    [{ playKey: 'ball', tabId: 10110, betCode: '第一球7', coin: 100 }],
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
    '可領金額沒有被重複疊加（維持 969，不是 1938）',
    Number(second.body?.claimable?.amount) === 969,
    `claimable=${second.body?.claimable?.amount}`
  )
}

async function main() {
  console.log('SSC-CD 測試腳本開始')
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
