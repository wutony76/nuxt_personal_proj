#!/usr/bin/env node
/**
 * 快3信用盤（K3-CD）隨時可跑的端到端測試腳本。
 *
 * 用法：
 *   npm run test:k3-cd
 *   node scripts/test-k3-cd.mjs
 *   BASE_URL=http://localhost:6100 node scripts/test-k3-cd.mjs
 *
 * 前提：
 *   - dev server 要跑著（`npm run dev`，預設 port 6100）
 *   - 用種子帳號 admin@example.com / 123456 登入（見 server/services/storage.ts）
 *   - 依賴保留下來的管理員限定測試工具 server/api/admin/k3cd-test-settle.post.ts
 *     （不用等真實開獎週期，用合成期別＋指定開獎號直接觸發結算）
 *
 * 涵蓋範圍：
 *   1. 當期資訊格式（issueCurrent／pool／currentStatus）
 *   2. 正常下注（單注／同分頁多注／跨分頁多組）與餘額扣款
 *   3. 拒單情境（不存在的注碼／低於單注下限）且確認未扣款
 *   4. 各玩法判定與派彩：和值、大小單雙（含開圍骰時的 tie 邊界）、三軍、圍骰指定、
 *      長牌、對子（含開圍骰時「不是」tie 的邊界，跟大小單雙的 tie 規則不同）
 *   5. 已結算期別不重複結算（冪等性）——K3-CD 的 `settleIssuePrize` 本身沒有防重複機制，
 *      這裡直接驗證測試工具自建的 guard 確實有效（`claimableIssues.amount` 沒有被重複疊加）
 *
 * ⚠️ 已知範圍限制：K3-CD／K3-OF 共用同一組開獎骰子與爆池（k3Shared.ts），爆池要等兩個
 * 盤口都對同一期交件才會真正結算分配。這支腳本只測 K3-CD 單邊，所以「開圍骰觸發爆池」
 * 的部分只驗證「該注單本身的固定賠率派彩正確」，不驗證爆池分潤金額（那需要 K3-OF 也交件，
 * 不在這支腳本範圍內）。
 *
 * ⚠️ 這支腳本會留下測試紀錄（不清除也不需要清除），所有測試期別都是獨立的合成期別
 * （`TEST-K3CD-*`），不會動到真實的 currentIndex／recordOpenCode。
 */

import { createTestRunner } from './_test-utils.mjs'

const { api, ok, section, login, summary } = createTestRunner()

async function getCoin() {
  const { body } = await api('/api/lottery/userInfo?lottery=K3-CD')
  return Number(body?.coin ?? NaN)
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery/k3-cd/current')
  ok('current API 回 200', status === 200)
  ok('issueCurrent 有值', typeof body?.issueCurrent === 'string' && body.issueCurrent.length > 0, body?.issueCurrent)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('pool 欄位存在（K3-CD／K3-OF 共用彩池）', body?.pool && typeof body.pool === 'object')
}

async function testBetting() {
  section('下注與拒單')
  const before = await getCoin()

  const singleBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 200100, key: 'K3-CD' },
      amount: 100,
      groups: [{
        playKey: 'sanjun',
        playTypeName: '三軍/大小/點數',
        selectTabId: 40000,
        playList: [{ playId: '40000-003', selectTabId: 40000, label: '三軍3', amount: 100 }]
      }]
    })
  })
  ok('單注下注成功', singleBet.status === 200 && singleBet.body?.orders?.length === 1, JSON.stringify(singleBet.body))

  const multiBetSameGroup = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 200100, key: 'K3-CD' },
      amount: 300,
      groups: [{
        playKey: 'sanjun',
        playTypeName: '三軍/大小/點數',
        selectTabId: 40000,
        playList: [
          { playId: '40000-101', selectTabId: 40000, label: '大', amount: 100 },
          { playId: '40000-210', selectTabId: 40000, label: '10', amount: 100 },
          { playId: '40000-003', selectTabId: 40000, label: '三軍3', amount: 100 }
        ]
      }]
    })
  })
  ok(
    '同分頁多注下注成功（三注）',
    multiBetSameGroup.status === 200 && multiBetSameGroup.body?.orders?.length === 3,
    JSON.stringify(multiBetSameGroup.body)
  )

  const crossGroupBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 200100, key: 'K3-CD' },
      amount: 200,
      groups: [
        {
          playKey: 'weitou',
          playTypeName: '圍骰/全骰',
          selectTabId: 40001,
          playList: [{ playId: '40001-001', selectTabId: 40001, label: '圍111', amount: 100 }]
        },
        {
          playKey: 'changduan',
          playTypeName: '長牌/短牌',
          selectTabId: 40002,
          playList: [{ playId: '40002-001', selectTabId: 40002, label: '長12', amount: 100 }]
        }
      ]
    })
  })
  ok(
    '跨分頁多組下注成功（各 1 注）',
    crossGroupBet.status === 200 && crossGroupBet.body?.orders?.length === 2,
    JSON.stringify(crossGroupBet.body)
  )

  const afterGoodBets = await getCoin()
  ok(
    '扣款金額正確（100 + 300 + 200 = 600）',
    Number.isFinite(before) && Number.isFinite(afterGoodBets) && Math.abs((before - afterGoodBets) - 600) < 0.001,
    `before=${before} after=${afterGoodBets}`
  )

  const balanceBeforeRejects = await getCoin()

  const invalidCode = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 200100, key: 'K3-CD' },
      amount: 100,
      groups: [{
        playKey: 'sanjun', selectTabId: 40000,
        playList: [{ playId: 'x', selectTabId: 40000, label: '三不同全', amount: 100 }]
      }]
    })
  })
  ok('拒單：設定表沒有的注碼（三不同全）→ 400', invalidCode.status === 400)

  const belowMin = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 200100, key: 'K3-CD' },
      amount: 1,
      groups: [{
        playKey: 'sanjun', selectTabId: 40000,
        playList: [{ playId: '40000-003', selectTabId: 40000, label: '三軍3', amount: 1 }]
      }]
    })
  })
  ok('拒單：單注低於下限 → 400', belowMin.status === 400)

  const balanceAfterRejects = await getCoin()
  ok(
    '兩種拒單情境皆未扣款',
    Math.abs(balanceBeforeRejects - balanceAfterRejects) < 0.001,
    `before=${balanceBeforeRejects} after=${balanceAfterRejects}`
  )
}

async function settle(bets, openCode, reuseIssue) {
  return api('/api/admin/k3cd-test-settle', {
    method: 'POST',
    body: JSON.stringify({ bets, openCode, ...(reuseIssue ? { reuseIssue } : {}) })
  })
}

async function testJudging() {
  section('各玩法判定與派彩（含圍骰邊界情境）')

  const cases = [
    { name: '和值10 中獎（sum=10）', playKey: 'sanjun', tabId: 40000, betCode: '10', openCode: [3, 3, 4], winStatus: 'win', winAmount: 776 },
    { name: '和值10 不中（sum=6）', playKey: 'sanjun', tabId: 40000, betCode: '10', openCode: [1, 2, 3], winStatus: 'lose', winAmount: 0 },
    { name: '大 中獎（sum=15）', playKey: 'sanjun', tabId: 40000, betCode: '大', openCode: [4, 5, 6], winStatus: 'win', winAmount: 194 },
    { name: '大 開圍骰 → 和局退本金（大小單雙的特例）', playKey: 'sanjun', tabId: 40000, betCode: '大', openCode: [2, 2, 2], winStatus: 'tie', winAmount: 100 },
    { name: '三軍3 中獎（含點3）', playKey: 'sanjun', tabId: 40000, betCode: '三軍3', openCode: [3, 5, 6], winStatus: 'win', winAmount: 230 },
    { name: '三軍3 不中（無點3）', playKey: 'sanjun', tabId: 40000, betCode: '三軍3', openCode: [1, 2, 5], winStatus: 'lose', winAmount: 0 },
    { name: '圍111 中獎（三顆都是1）', playKey: 'weitou', tabId: 40001, betCode: '圍111', openCode: [1, 1, 1], winStatus: 'win', winAmount: 20952 },
    { name: '圍111 開圍骰但點數不對 → lose（不是 tie）', playKey: 'weitou', tabId: 40001, betCode: '圍111', openCode: [2, 2, 2], winStatus: 'lose', winAmount: 0 },
    { name: '長12 中獎（1、2都出現）', playKey: 'changduan', tabId: 40002, betCode: '長12', openCode: [1, 2, 5], winStatus: 'win', winAmount: 698 },
    { name: '對11 中獎（恰兩顆1）', playKey: 'changduan', tabId: 40002, betCode: '對11', openCode: [1, 1, 4], winStatus: 'win', winAmount: 1396 },
    { name: '對11 開圍骰111 → lose（跟「大」的 tie 規則不同，對子沒有和局機制）', playKey: 'changduan', tabId: 40002, betCode: '對11', openCode: [1, 1, 1], winStatus: 'lose', winAmount: 0 }
  ]

  for (const testCase of cases) {
    const { status, body } = await settle(
      [{ playKey: testCase.playKey, tabId: testCase.tabId, betCode: testCase.betCode, coin: 100 }],
      testCase.openCode
    )
    const row = body?.settledRows?.[0]
    ok(
      testCase.name,
      status === 200 && row?.winStatus === testCase.winStatus && Number(row?.winAmount) === testCase.winAmount,
      JSON.stringify(row)
    )
  }
}

async function testIdempotency() {
  section('已結算期別不重複結算（K3-CD 的 settleIssuePrize 本身無防重複，驗證測試工具自建的 guard）')
  const reuseIssue = `TEST-K3CD-IDEMPOTENT-${Date.now()}`

  const first = await settle(
    [{ playKey: 'sanjun', tabId: 40000, betCode: '三軍3', coin: 100 }],
    [3, 5, 6],
    reuseIssue
  )
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：可領金額正確（230）', Number(first.body?.claimable?.amount) === 230)

  const second = await settle(
    [{ playKey: 'sanjun', tabId: 40000, betCode: '三軍3', coin: 100 }],
    [3, 5, 6],
    reuseIssue
  )
  ok('第二次呼叫：alreadySettledBefore = true', second.body?.alreadySettledBefore === true)
  ok(
    '第二次呼叫：新注單維持 pending（不會被結算）',
    second.body?.settledRows?.[0]?.winStatus === 'pending',
    JSON.stringify(second.body?.settledRows?.[0])
  )
  ok(
    '可領金額沒有被重複疊加（維持 230，不是 460）',
    Number(second.body?.claimable?.amount) === 230,
    `claimable=${second.body?.claimable?.amount}`
  )
}

async function main() {
  console.log('K3-CD 測試腳本開始')
  await login()
  await testCurrentInfo()
  await testBetting()
  await testJudging()
  await testIdempotency()

  summary()
}

main().catch((err) => {
  console.error('測試腳本執行時發生未預期錯誤：', err)
  process.exitCode = 1
})
