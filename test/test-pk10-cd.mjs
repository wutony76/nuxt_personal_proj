#!/usr/bin/env node
/**
 * PK10 信用盤（PK10-CD）隨時可跑的端到端測試腳本。
 *
 * 用法：
 *   npm run test:pk10-cd
 *   node test/test-pk10-cd.mjs
 *   BASE_URL=http://localhost:6100 node test/test-pk10-cd.mjs
 *
 * 前提：同其他彩種——dev server 要跑著、用種子帳號登入、依賴保留下來的
 * 管理員限定測試工具 server/api/admin/pk10cd-test-settle.post.ts。
 *
 * 涵蓋範圍：
 *   1. 當期資訊格式（issue／openCode／pool，pool 與 PK10-OF 共用）
 *   2. 正常下注與拒單（不存在的注碼／低於單注下限）且確認未扣款
 *   3. 5 個玩法判定與賠率：定位膽、兩面、冠亞組合、冠亞軍和、龍虎鬥；
 *      以及「無法辨識注碼視為和局全額退還」的邊界（PK10 名次必分得出、車號互異，
 *      沒有快3圍骰那種真正的和局，tie 只用在無效注碼的防禦性退款）
 *   4. 已結算期別不重複結算（冪等性）
 *
 * ⚠️ PK10-CD 的 settleIssuePrize 不會碰共用彩池（PK10_SHARED.pool，那個只有
 * PK10-OF 的前三直選在寫），只會交件給共用爆池層（需要 CD/OF 都交件才會真的分配，
 * 這裡的合成期別只有 CD 交件，爆池永遠不會被結算，也就不會誤動到真實爆池滾存）——
 * 因此這支腳本不需要像 test-pk10-of.mjs 那樣做彩池快照/還原的安全性測試。
 *
 * ⚠️ 這支腳本會留下測試紀錄（不清除也不需要清除），所有測試期別都是獨立的合成期別
 * （`TEST-PK10CD-*`），不會動到真實的 currentIndex／recordOpenCode。
 */

import { createTestRunner } from './_test-utils.mjs'

const { api, ok, section, login, summary, waitForOpen } = createTestRunner()

async function getCoin() {
  const { body } = await api('/api/lottery/userInfo?lottery=PK10-CD')
  return Number(body?.coin ?? NaN)
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery/pk10-cd/current')
  ok('current API 回 200', status === 200)
  ok('issue 有值', typeof body?.issue === 'string' && body.issue.length > 0, body?.issue)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('openCode 為 10 台車名次表', Array.isArray(body?.openCode) && body.openCode.length === 10)
  ok('pool 欄位存在（與 PK10-OF 共用同一份彩池）', body?.pool && typeof body.pool === 'object')
}

async function testBetting() {
  section('下注與拒單')
  await waitForOpen('/api/lottery/pk10-cd/current')
  const before = await getCoin()

  const bet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 300100, key: 'PK10-CD' },
      amount: 100,
      groups: [{ playKey: 'dingwei', playTypeName: '定位膽', selectTabId: 14113, playList: [{ label: '冠軍03', amount: 100 }] }]
    })
  })
  ok('定位膽下注成功', bet.status === 200 && bet.body?.orders?.length === 1, JSON.stringify(bet.body))

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
      lottery: { id: 300100, key: 'PK10-CD' },
      amount: 100,
      groups: [{ playKey: 'dingwei', selectTabId: 14113, playList: [{ label: '冠軍99', amount: 100 }] }]
    })
  })
  ok('拒單：不存在的注碼（冠軍99）→ 400', invalidCode.status === 400)

  const belowMin = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 300100, key: 'PK10-CD' },
      amount: 1,
      groups: [{ playKey: 'dingwei', selectTabId: 14113, playList: [{ label: '冠軍03', amount: 1 }] }]
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
  return api('/api/admin/pk10cd-test-settle', {
    method: 'POST',
    body: JSON.stringify({ bets, openCode, ...(reuseIssue ? { reuseIssue } : {}) })
  })
}

async function testPlayJudging() {
  section('5 個玩法判定與派彩')
  // 開獎：冠軍車3、亞軍車7、第三名車1…第十名車10（第10位 rank=10 是車10）
  const openCode = [3, 7, 1, 5, 9, 2, 4, 6, 8, 10]

  const cases = [
    { name: '定位膽「冠軍03」中獎（冠軍實際車=3）', playKey: 'dingwei', tabId: 14113, betCode: '冠軍03', winStatus: 'win', winAmount: 969, odds: 9.69 },
    { name: '定位膽「冠軍05」不中', playKey: 'dingwei', tabId: 14113, betCode: '冠軍05', winStatus: 'lose', winAmount: 0 },
    { name: '兩面「冠軍大」不中（冠軍車3 < 6）', playKey: 'liangmian', tabId: 14114, betCode: '冠軍大', winStatus: 'lose', winAmount: 0 },
    { name: '兩面「冠軍小」中獎', playKey: 'liangmian', tabId: 14114, betCode: '冠軍小', winStatus: 'win', winAmount: 194, odds: 1.94 },
    { name: '冠亞軍和「和10」中獎（冠亞和=3+7=10）', playKey: 'guanyahe', tabId: 14116, betCode: '和10', winStatus: 'win', winAmount: 1091, coin: 100, odds: 10.91 },
    { name: '冠亞組合「組合03-07」中獎（不分順序）', playKey: 'zuhe', tabId: 14115, betCode: '組合03-07', winStatus: 'win', winAmount: 4365, coin: 100, odds: 43.65 },
    { name: '龍虎鬥「冠軍虎」中獎（冠軍車3 < 第十名車10）', playKey: 'longhu', tabId: 14117, betCode: '冠軍虎', winStatus: 'win', winAmount: 194, odds: 1.94 },
    { name: '龍虎鬥「冠軍龍」不中', playKey: 'longhu', tabId: 14117, betCode: '冠軍龍', winStatus: 'lose', winAmount: 0 },
    { name: '⚠️ 無法辨識注碼視為和局全額退還', playKey: 'dingwei', tabId: 14113, betCode: '亂碼XYZ', winStatus: 'tie', winAmount: 100 }
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
  const reuseIssue = `TEST-PK10CD-IDEMPOTENT-${Date.now()}`
  const openCode = [3, 7, 1, 5, 9, 2, 4, 6, 8, 10]

  const first = await settle(
    [{ playKey: 'dingwei', tabId: 14113, betCode: '冠軍03', coin: 100 }],
    openCode,
    reuseIssue
  )
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：可領金額正確（969）', Number(first.body?.claimable?.amount) === 969)

  const second = await settle(
    [{ playKey: 'dingwei', tabId: 14113, betCode: '冠軍03', coin: 100 }],
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
  console.log('PK10-CD 測試腳本開始')
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
