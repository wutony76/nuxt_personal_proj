#!/usr/bin/env node
/**
 * 六合彩官方盤（6HC-OF）隨時可跑的端到端測試腳本。
 *
 * 用法：
 *   npm run test:6hc-of
 *   node scripts/test-6hc-of.mjs
 *   BASE_URL=http://localhost:6100 node scripts/test-6hc-of.mjs
 *
 * 前提：同其他彩種——dev server 要跑著、用種子帳號登入、依賴保留下來的
 * 管理員限定測試工具 server/api/admin/6hcof-test-settle.post.ts。
 *
 * 玩法比 6HC-CD 單純很多：一注 = 選任意幾個號碼（1~49），依「命中幾顆正碼＋是否
 * 命中特別號」對到 ISSUE_PRIZE_TIERS 的其中一層（頭獎~七獎，見 6hcOf.ts:86-94），
 * 跟 6HC-CD 完全獨立（各自的期別／彩池／注單），也跟 6HC-CD 的下注驗證不同——
 * ⚠️ 6HC-OF 的 playBets 完全沒有 validateBetQuota 這類拒單機制（已讀原始碼確認），
 * 所以這支腳本沒有「拒單」測試段落，這是如實反映現狀，不是遺漏。
 *
 * 涵蓋範圍：
 *   1. 當期資訊格式（issue／openCode／jackpot）
 *   2. 正常下注與餘額扣款
 *   3. 7 個獎項分層判定與派彩：頭獎/二獎/三獎（彩池比例＋最低保障，只驗證
 *      floor 不驗證精確金額——與即時彩池餘額有關）、四~七獎（固定倍數，可精確驗證）、
 *      以及完全不中的 lose 情境
 *   4. ⚠️ 彩池共用狀態安全性：settleIssuePrize 結算尾端會無條件覆寫
 *      `this.carryJackpot`（跟 6HC-CD／K3-OF 同構的坑，但這裡的滾存是 6HC-OF
 *      自己單例持有，不跨盤口共用）。驗證測試工具的「呼叫前快照、呼叫後還原」
 *      機制確實擋下了這個會永久污染正式彩池的風險
 *   5. 已結算期別不重複結算（冪等性）
 *
 * ⚠️ 這支腳本會留下測試紀錄（不清除也不需要清除），所有測試期別都是獨立的合成期別
 * （`TEST-LHCOF-*`），不會動到真實的 currentIndex／recordOpenCode。
 */

import { createTestRunner } from './_test-utils.mjs'

const { api, ok, section, login, summary, waitForOpen } = createTestRunner()

const BASE_FIRST_PRIZE = 200000
const SECOND_PRIZE_MIN = 50000
const THIRD_PRIZE_MIN = 3500

async function getCoin() {
  const { body } = await api('/api/lottery/userInfo?lottery=LHC-OF')
  return Number(body?.coin ?? NaN)
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery/6hc-of/current')
  ok('current API 回 200', status === 200)
  ok('issue 有值', typeof body?.issue === 'string' && body.issue.length > 0, body?.issue)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('openCode 為 7 顆球', Array.isArray(body?.openCode) && body.openCode.length === 7)
  ok('jackpot 欄位存在', body?.jackpot && typeof body.jackpot === 'object')
}

async function testBetting() {
  section('下注與餘額')
  await waitForOpen('/api/lottery/6hc-of/current')
  const before = await getCoin()

  const bet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 100101, key: 'LHC-OF' },
      amount: 100,
      groups: [{
        betCount: 1,
        playList: [{ num: 1 }, { num: 2 }, { num: 3 }, { num: 4 }, { num: 5 }, { num: 6 }]
      }]
    })
  })
  ok(
    '選 6 個號下注成功（注碼補零）',
    bet.status === 200 && JSON.stringify(bet.body?.orders?.[0]?.bet_code) === JSON.stringify(['01', '02', '03', '04', '05', '06']),
    JSON.stringify(bet.body)
  )

  const after = await getCoin()
  ok(
    '扣款金額正確（100）',
    Number.isFinite(before) && Number.isFinite(after) && Math.abs((before - after) - 100) < 0.001,
    `before=${before} after=${after}`
  )
}

async function settle(bets, openCode, extra) {
  return api('/api/admin/6hcof-test-settle', {
    method: 'POST',
    body: JSON.stringify({ bets, openCode, ...(extra || {}) })
  })
}

async function testTiers() {
  section('7 個獎項分層判定與派彩')
  const openCode = [1, 2, 3, 4, 5, 6, 7]

  const poolCases = [
    { name: '頭獎（6正、無特別號，彩池比例＋最低保障 200000／單位）', betCode: ['1', '2', '3', '4', '5', '6'], minFloor: BASE_FIRST_PRIZE, matchCount: 6, specialMatch: false },
    { name: '二獎（5正＋特別號，最低保障 50000／單位）', betCode: ['1', '2', '3', '4', '5', '7'], minFloor: SECOND_PRIZE_MIN, matchCount: 5, specialMatch: true },
    { name: '三獎（5正、無特別號，最低保障 3500／單位）', betCode: ['1', '2', '3', '4', '5', '8'], minFloor: THIRD_PRIZE_MIN, matchCount: 5, specialMatch: false }
  ]
  for (const testCase of poolCases) {
    const { status, body } = await settle([{ betCode: testCase.betCode, coin: 100 }], openCode)
    const row = body?.settledRows?.[0]
    ok(
      `${testCase.name}：分層與命中組成正確、派彩不低於最低保障（×100 注金）`,
      status === 200 && row?.winStatus === 'win' && row?.matchCount === testCase.matchCount &&
      row?.specialMatch === testCase.specialMatch && Number(row?.winAmount) >= testCase.minFloor * 100,
      JSON.stringify(row)
    )
  }

  const fixedCases = [
    { name: '四獎（4正＋特別號，固定 3000 倍）', betCode: ['1', '2', '3', '4', '7', '8'], matchCount: 4, specialMatch: true, winAmount: 300000 },
    { name: '五獎（4正、無特別號，固定 200 倍）', betCode: ['1', '2', '3', '4', '8', '9'], matchCount: 4, specialMatch: false, winAmount: 20000 },
    { name: '六獎（3正＋特別號，固定 10 倍）', betCode: ['1', '2', '3', '7', '8', '9'], matchCount: 3, specialMatch: true, winAmount: 1000 },
    { name: '七獎（3正、無特別號，固定 5 倍）', betCode: ['1', '2', '3', '8', '9', '10'], matchCount: 3, specialMatch: false, winAmount: 500 }
  ]
  for (const testCase of fixedCases) {
    const { status, body } = await settle([{ betCode: testCase.betCode, coin: 100 }], openCode)
    const row = body?.settledRows?.[0]
    ok(
      testCase.name,
      status === 200 && row?.winStatus === 'win' && row?.matchCount === testCase.matchCount &&
      row?.specialMatch === testCase.specialMatch && Number(row?.winAmount) === testCase.winAmount,
      JSON.stringify(row)
    )
  }

  const { status, body } = await settle([{ betCode: ['8', '9', '10', '11', '12', '13'], coin: 100 }], openCode)
  const row = body?.settledRows?.[0]
  ok(
    '完全不中 → lose、0 顆命中',
    status === 200 && row?.winStatus === 'lose' && row?.matchCount === 0 && Number(row?.winAmount) === 0,
    JSON.stringify(row)
  )
}

async function testJackpotCarrySafety() {
  section('彩池共用狀態安全性（驗證測試不會污染正式彩池 carryJackpot）')

  const { status, body } = await settle(
    [{ betCode: ['1', '2', '3', '4', '5', '6'], coin: 1000 }],
    [1, 2, 3, 4, 5, 6, 7],
    { seedIssuePool: 50000 }
  )
  ok('頭獎測試結算成功', status === 200 && body?.settledRows?.[0]?.winStatus === 'win', JSON.stringify(body?.settledRows?.[0]))
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
}

async function testIdempotency() {
  section('已結算期別不重複結算（冪等性）')
  const reuseIssue = `TEST-LHCOF-IDEMPOTENT-${Date.now()}`

  const first = await settle(
    [{ betCode: ['1', '2', '3', '8', '9', '10'], coin: 100 }],
    [1, 2, 3, 4, 5, 6, 7],
    { reuseIssue }
  )
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：可領金額正確（500，七獎固定 5 倍）', Number(first.body?.claimable?.amount) === 500)

  const second = await settle(
    [{ betCode: ['1', '2', '3', '8', '9', '10'], coin: 100 }],
    [1, 2, 3, 4, 5, 6, 7],
    { reuseIssue }
  )
  ok('第二次呼叫：alreadySettledBefore = true', second.body?.alreadySettledBefore === true)
  ok(
    '第二次呼叫：新注單維持 pending（不會被結算）',
    second.body?.settledRows?.[0]?.winStatus === 'pending',
    JSON.stringify(second.body?.settledRows?.[0])
  )
  ok(
    '可領金額沒有被重複疊加（維持 500，不是 1000）',
    Number(second.body?.claimable?.amount) === 500,
    `claimable=${second.body?.claimable?.amount}`
  )
}

async function main() {
  console.log('6HC-OF 測試腳本開始')
  await login()
  await testCurrentInfo()
  await testBetting()
  await testTiers()
  await testJackpotCarrySafety()
  await testIdempotency()

  summary()
}

main().catch((err) => {
  console.error('測試腳本執行時發生未預期錯誤：', err)
  process.exitCode = 1
})
