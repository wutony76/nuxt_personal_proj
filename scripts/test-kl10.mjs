#!/usr/bin/env node
/**
 * 快樂十分（KL10）隨時可跑的端到端測試腳本。
 *
 * 用法：
 *   npm run test:kl10
 *   node scripts/test-kl10.mjs
 *   BASE_URL=http://localhost:6100 node scripts/test-kl10.mjs
 *
 * 前提：同其他彩種——dev server 要跑著、用種子帳號登入、依賴保留下來的
 * 管理員限定測試工具 server/api/admin/kl10-test-settle.post.ts。
 *
 * ⚠️ KL10 只有信用盤（沒有 CD/OF 之分），全站只有一個 instance，跟 EGGS 同構：
 * 玩家看到的彩池／爆池滾存就是這個 instance 的 `carryPool`／`carryJackpot` 兩個欄位，
 * settleIssuePrize 單次呼叫就無條件覆寫，沒有其他彩種 CD/OF 成對盤口那種
 * 「等雙方交件才真的分配」的天然緩衝。測試工具對這兩者都做「呼叫前快照、
 * 呼叫後同步還原」，本腳本的「彩池與爆池安全性」段落會直接驗證這點。
 *
 * 涵蓋範圍：
 *   1. 當期資訊格式（issue／openCode，8 個 1~20 互不重複）
 *   2. 正常下注（固定賠率玩法／選號彩池玩法）與拒單（不存在的注碼）
 *   3. 4 個固定賠率玩法判定與賠率：正和（單碼＋兩面）、龍虎鬥（無和局）、
 *      任選（N 碼全中才算中）、兩面（總和六面＋上下盤＋奇偶盤）；
 *      以及「無法辨識注碼視為和局全額退還」的邊界（正常下注流程不可達，
 *      需繞過驗證直接建單才能觸發，這裡透過測試工具直接測）
 *   4. 選號（xuanhao）彩池玩法依命中顆數（4碼中對中幾碼）分層：頭獎/二獎
 *      （彩池比例＋頭獎最低保障，只驗證分層與 floor）、三獎（固定 2 倍，可精確驗證）
 *   5. ⚠️ 彩池與爆池安全性：驗證測試工具的「呼叫前快照、呼叫後還原」機制
 *      確實擋下了會永久污染正式 carryPool／carryJackpot 的風險
 *   6. 已結算期別不重複結算（冪等性）
 *
 * ⚠️ 這支腳本會留下測試紀錄（不清除也不需要清除），所有測試期別都是獨立的合成期別
 * （`TEST-KL10-*`），不會動到真實的 currentIndex／recordOpenCode。
 */

import { createTestRunner } from './_test-utils.mjs'

const { api, ok, section, login, summary } = createTestRunner()

async function getCoin() {
  const { body } = await api('/api/lottery/userInfo?lottery=KL10')
  return Number(body?.coin ?? NaN)
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery/kl10/current')
  ok('current API 回 200', status === 200)
  ok('issue 有值', typeof body?.issue === 'string' && body.issue.length > 0, body?.issue)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('openCode 為 8 個號碼', Array.isArray(body?.openCode) && body.openCode.length === 8)
}

async function testBetting() {
  section('下注與拒單')
  const before = await getCoin()

  const oddsBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 7001, key: 'KL10' },
      amount: 100,
      groups: [{ playKey: 'zhenghe', playTypeName: '正和', selectTabId: 1321010, playList: [{ label: '第一球05', amount: 100 }] }]
    })
  })
  ok('正和下注成功', oddsBet.status === 200 && oddsBet.body?.orders?.length === 1, JSON.stringify(oddsBet.body))

  const poolBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 7001, key: 'KL10' },
      amount: 10,
      groups: [{ playKey: 'xuanhao', playTypeName: '選號', playList: [{ codes: [5, 12, 20, 1], amount: 10 }] }]
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
      lottery: { id: 7001, key: 'KL10' },
      amount: 100,
      groups: [{ playKey: 'zhenghe', selectTabId: 1321010, playList: [{ label: '不存在', amount: 100 }] }]
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
  return api('/api/admin/kl10-test-settle', {
    method: 'POST',
    body: JSON.stringify({ ...payload, ...(reuseIssue ? { reuseIssue } : {}) })
  })
}

async function testPlayJudging() {
  section('4 個固定賠率玩法判定與派彩')
  const openCode = [5, 12, 20, 1, 8, 15, 3, 10]

  const cases = [
    { name: '正和「第一球05」中獎（第一球=5）', playKey: 'zhenghe', tabId: 1321010, betCode: '第一球05', winAmount: 1939 },
    { name: '正和「第二球07」不中（第二球=12）', playKey: 'zhenghe', tabId: 1321011, betCode: '第二球07', winAmount: 0 },
    { name: '正和「第三球大」中獎（第三球=20≥11）', playKey: 'zhenghe', tabId: 1321012, betCode: '第三球大', winAmount: 97, coin: 50 },
    { name: '龍虎鬥「龍虎12虎」中獎（第一球5 < 第二球12，無和局）', playKey: 'longhu', tabId: 13211, betCode: '龍虎12虎', winAmount: 58.2, coin: 30 },
    { name: '龍虎鬥「龍虎12龍」不中', playKey: 'longhu', tabId: 13211, betCode: '龍虎12龍', winAmount: 0, coin: 30 },
    { name: '任選「任二中二05,10」中獎（5、10都在開獎8碼內）', playKey: 'renxuan', tabId: 1321211, betCode: '任二中二05,10', winAmount: 131.6, coin: 20 },
    { name: '任選「任二中二02,04」不中（都不在開獎8碼內）', playKey: 'renxuan', tabId: 1321211, betCode: '任二中二02,04', winAmount: 0, coin: 20 },
    { name: '兩面「總和小」中獎（總和=74<84）', playKey: 'liangmian', tabId: 13213, betCode: '總和小', winAmount: 20, coin: 10 },
    { name: '兩面「上盤」中獎（≤10的號碼5個 > >10的號碼3個）', playKey: 'liangmian', tabId: 13213, betCode: '上盤', winAmount: 44.7, coin: 15 },
    { name: '兩面「奇偶和」中獎（奇偶各4個，4:4）', playKey: 'liangmian', tabId: 13213, betCode: '奇偶和', winAmount: 69.25, coin: 25 },
    { name: '⚠️ 無法辨識注碼視為和局全額退還', playKey: 'zhenghe', tabId: 1321010, betCode: '亂碼XYZ', winAmount: 40, coin: 40 }
  ]

  for (const testCase of cases) {
    const coin = testCase.coin ?? 100
    const { status, body } = await settle({
      bets: [{ playKey: testCase.playKey, tabId: testCase.tabId, betCode: testCase.betCode, coin }],
      openCode
    })
    const row = body?.settledRows?.[0]
    const expected = testCase.betCode === '亂碼XYZ' ? 'tie' : (testCase.winAmount > 0 ? 'win' : 'lose')
    ok(
      testCase.name,
      status === 200 && row?.winStatus === expected && Number(row?.winAmount) === testCase.winAmount,
      JSON.stringify(row)
    )
  }
}

async function testPoolTiers() {
  section('選號（xuanhao）彩池玩法依命中顆數（4碼）分層')
  const openCode = [5, 12, 20, 1, 8, 15, 3, 10]

  const topTier = await settle({ poolBets: [{ picks: [5, 12, 20, 1], coin: 10 }], openCode })
  const topRow = topTier.body?.settledRows?.[0]
  ok(
    '命中4顆（全對）→ 頭獎（彩池比例＋最低保障 20000，只驗證命中數與門檻）',
    topTier.status === 200 && topRow?.matchCount === 4 && Number(topRow?.winAmount) >= 20000,
    JSON.stringify(topRow)
  )

  const secondTier = await settle({ poolBets: [{ picks: [5, 12, 20, 2], coin: 10 }], openCode })
  const secondRow = secondTier.body?.settledRows?.[0]
  ok(
    '命中3顆 → 二獎（彩池比例，只驗證命中數與正派彩，不驗證精確金額）',
    secondTier.status === 200 && secondRow?.matchCount === 3 && Number(secondRow?.winAmount) > 0,
    JSON.stringify(secondRow)
  )

  const fixedTier = await settle({ poolBets: [{ picks: [5, 12, 2, 4], coin: 25 }], openCode })
  const fixedRow = fixedTier.body?.settledRows?.[0]
  ok(
    '命中2顆 → 三獎（固定倍數，可精確驗證：2 × 25 = 50）',
    fixedTier.status === 200 && fixedRow?.matchCount === 2 && Number(fixedRow?.winAmount) === 50,
    JSON.stringify(fixedRow)
  )

  const noHit = await settle({ poolBets: [{ picks: [2, 4, 6, 7], coin: 10 }], openCode })
  const noHitRow = noHit.body?.settledRows?.[0]
  ok(
    '完全不中 → lose、0 顆命中',
    noHit.status === 200 && noHitRow?.matchCount === 0 && noHitRow?.winStatus === 'lose' && Number(noHitRow?.winAmount) === 0,
    JSON.stringify(noHitRow)
  )
}

async function testPoolAndJackpotSafety() {
  section('彩池與爆池安全性（驗證測試不會污染正式 carryPool／carryJackpot）')

  // 8 碼全奇（奇偶一邊倒）觸發爆池
  const { status, body } = await settle({
    bets: [{ playKey: 'zhenghe', tabId: 1321010, betCode: '第一球01', coin: 1000 }],
    openCode: [1, 3, 5, 7, 9, 11, 13, 15]
  })
  ok('全奇開獎結算成功（觸發爆池條件）', status === 200 && body?.settledRows?.[0]?.winStatus === 'win', JSON.stringify(body?.settledRows?.[0]))
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

  const poolResult = await settle({
    poolBets: [{ picks: [1, 2, 3, 4], coin: 10 }],
    openCode: [1, 2, 3, 4, 5, 6, 7, 8]
  })
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
  const reuseIssue = `TEST-KL10-IDEMPOTENT-${Date.now()}`
  const openCode = [5, 12, 20, 1, 8, 15, 3, 10]

  const first = await settle(
    { bets: [{ playKey: 'zhenghe', tabId: 1321010, betCode: '第一球05', coin: 100 }], openCode },
    reuseIssue
  )
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：可領金額正確（1939）', Number(first.body?.claimable?.amount) === 1939)

  const second = await settle(
    { bets: [{ playKey: 'zhenghe', tabId: 1321010, betCode: '第一球05', coin: 100 }], openCode },
    reuseIssue
  )
  ok('第二次呼叫：alreadySettledBefore = true', second.body?.alreadySettledBefore === true)
  ok(
    '第二次呼叫：新注單維持 pending（不會被結算）',
    second.body?.settledRows?.[0]?.winStatus === 'pending',
    JSON.stringify(second.body?.settledRows?.[0])
  )
  ok(
    '可領金額沒有被重複疊加（維持 1939，不是 3878）',
    Number(second.body?.claimable?.amount) === 1939,
    `claimable=${second.body?.claimable?.amount}`
  )
}

async function main() {
  console.log('KL10 測試腳本開始')
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
