#!/usr/bin/env node
/**
 * 福彩3D（FC3D）隨時可跑的端到端測試腳本。
 *
 * 用法：
 *   npm run test:fc3d
 *   node scripts/test-fc3d.mjs
 *   BASE_URL=http://localhost:6100 node scripts/test-fc3d.mjs
 *
 * 前提：同其他彩種——dev server 要跑著、用種子帳號登入、依賴保留下來的
 * 管理員限定測試工具 server/api/admin/fc3d-test-settle.post.ts。
 *
 * ⚠️ FC3D 只有官方盤（沒有信用盤），全站只有一個 instance，跟 EGGS／KL10／KL8 同構，
 * 而且同時有兩個獨立的池：全站爆池（開豹子觸發，carryJackpot）與三星直選分層彩池
 * （carryPool）。settleIssuePrize 單次呼叫就對兩者都無條件覆寫，沒有其他彩種 CD/OF
 * 成對盤口那種「等雙方交件才真的分配」的天然緩衝。測試工具對兩者都做「呼叫前快照、
 * 呼叫後同步還原」，本腳本的「彩池與爆池安全性」段落會分別驗證這兩個池。
 *
 * 涵蓋範圍：
 *   1. 當期資訊格式（issue／openCode，3 個 0~9 可重複）
 *   2. 正常下注（固定賠率玩法／三星直選彩池玩法）與拒單（不存在的注碼）
 *   3. 5 個固定賠率玩法判定與賠率：定位膽、直選組選（前二/後二直選、前二組選）、
 *      三星（組三/組六/直選和值/組選和值，含「豹子對直選和值算中、對組選和值不算中」
 *      這組相反判定）、不定位（一碼/二碼）、大小單雙；以及「無法辨識注碼視為和局
 *      全額退還」的邊界
 *   4. 三星直選（sanxing 底下唯一吃彩池的分頁）依命中位數分層：頭獎/二獎（彩池比例＋
 *      最低保障，只驗證分層與 floor）、三獎（固定 2 倍，可精確驗證）
 *   5. ⚠️ 彩池與爆池安全性：驗證測試工具的「呼叫前快照、呼叫後還原」機制
 *      確實擋下了會永久污染正式 carryPool／carryJackpot 的風險
 *   6. 已結算期別不重複結算（冪等性）
 *
 * ⚠️ 這支腳本會留下測試紀錄（不清除也不需要清除），所有測試期別都是獨立的合成期別
 * （`TEST-FC3D-*`），不會動到真實的 currentIndex／recordOpenCode。
 */

import { createTestRunner } from './_test-utils.mjs'

const { api, ok, section, login, summary, waitForOpen } = createTestRunner()

async function getCoin() {
  const { body } = await api('/api/lottery/userInfo?lottery=FC3D')
  return Number(body?.coin ?? NaN)
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery/fc3d/current')
  ok('current API 回 200', status === 200)
  ok('issue 有值', typeof body?.issue === 'string' && body.issue.length > 0, body?.issue)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('openCode 為 3 個號碼', Array.isArray(body?.openCode) && body.openCode.length === 3)
}

async function testBetting() {
  section('下注與拒單')
  await waitForOpen('/api/lottery/fc3d/current')
  const before = await getCoin()

  const oddsBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 9001, key: 'FC3D' },
      amount: 100,
      groups: [{ playKey: 'dingwei', playTypeName: '定位膽', selectTabId: 181101010, playList: [{ label: '百位7', amount: 100 }] }]
    })
  })
  ok('定位膽下注成功', oddsBet.status === 200 && oddsBet.body?.orders?.length === 1, JSON.stringify(oddsBet.body))

  const poolBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 9001, key: 'FC3D' },
      amount: 10,
      groups: [{ playKey: 'sanxing', selectTabId: 181121010, playList: [{ label: '三星直選123', amount: 10 }] }]
    })
  })
  ok('三星直選下注成功', poolBet.status === 200 && poolBet.body?.orders?.length === 1, JSON.stringify(poolBet.body))

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
      lottery: { id: 9001, key: 'FC3D' },
      amount: 100,
      groups: [{ playKey: 'dingwei', selectTabId: 181101010, playList: [{ label: '不存在', amount: 100 }] }]
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
  return api('/api/admin/fc3d-test-settle', {
    method: 'POST',
    body: JSON.stringify({ ...payload, ...(reuseIssue ? { reuseIssue } : {}) })
  })
}

async function testPlayJudging() {
  section('5 個固定賠率玩法判定與派彩')

  const cases = [
    { name: '定位膽「百位7」中獎（百位=7）', playKey: 'dingwei', tabId: 181101010, betCode: '百位7', openCode: [7, 3, 3], winAmount: 960, coin: 100 },
    { name: '定位膽「百位7」不中（開333）', playKey: 'dingwei', tabId: 181101010, betCode: '百位7', openCode: [3, 3, 3], winAmount: 0, coin: 100 },
    { name: '前二直選「前二直選12」中獎（百十=1,2，有序）', playKey: 'zhixuan', tabId: 181111010, betCode: '前二直選12', openCode: [1, 2, 5], winAmount: 4800, coin: 50 },
    { name: '前二直選「前二直選12」不中（順序相反）', playKey: 'zhixuan', tabId: 181111010, betCode: '前二直選12', openCode: [2, 1, 5], winAmount: 0, coin: 50 },
    { name: '前二組選「前二組選12」中獎（不分順序）', playKey: 'zhixuan', tabId: 181111110, betCode: '前二組選12', openCode: [2, 1, 5], winAmount: 2400, coin: 50 },
    { name: '三星組三「三星組三112」中獎（恰兩碼相同）', playKey: 'sanxing', tabId: 181121110, betCode: '三星組三112', openCode: [1, 1, 2], winAmount: 3200, coin: 10 },
    { name: '三星組三「三星組三112」不中（開111豹子，非{A,A,B}）', playKey: 'sanxing', tabId: 181121110, betCode: '三星組三112', openCode: [1, 1, 1], winAmount: 0, coin: 10 },
    { name: '三星組六「三星組六123」中獎（三碼互異）', playKey: 'sanxing', tabId: 181121111, betCode: '三星組六123', openCode: [3, 2, 1], winAmount: 1600, coin: 10 },
    { name: '三星直選和值「三星直選和值9」中獎（開333豹子，和值算）', playKey: 'sanxing', tabId: 181121012, betCode: '三星直選和值9', openCode: [3, 3, 3], winAmount: 174.5, coin: 10 },
    { name: '⚠️ 三星組選和值「三星組選和值9」不中（開333豹子，被排除——跟上一項相反判定）', playKey: 'sanxing', tabId: 181121112, betCode: '三星組選和值9', openCode: [3, 3, 3], winAmount: 0, coin: 10 },
    { name: '一碼不定位「一碼不定位5」中獎（5出現在某一位）', playKey: 'budingwei', tabId: 181131010, betCode: '一碼不定位5', openCode: [5, 1, 1], winAmount: 35.4, coin: 10 },
    { name: '一碼不定位「一碼不定位5」不中', playKey: 'budingwei', tabId: 181131010, betCode: '一碼不定位5', openCode: [1, 1, 1], winAmount: 0, coin: 10 },
    { name: '二碼不定位「二碼不定位12」中獎（1、2都出現）', playKey: 'budingwei', tabId: 181131011, betCode: '二碼不定位12', openCode: [1, 2, 5], winAmount: 177.8, coin: 10 },
    { name: '大小單雙「大小單雙前二大大」中獎（百十皆≥5）', playKey: 'daxiao', tabId: 181141010, betCode: '大小單雙前二大大', openCode: [6, 7, 3], winAmount: 38.4, coin: 10 },
    { name: '大小單雙「大小單雙後二單雙」中獎（十=3單、個=4雙）', playKey: 'daxiao', tabId: 181141011, betCode: '大小單雙後二單雙', openCode: [6, 3, 4], winAmount: 38.4, coin: 10 },
    { name: '⚠️ 無法辨識注碼視為和局全額退還', playKey: 'dingwei', tabId: 181101010, betCode: '亂碼XYZ', openCode: [7, 3, 3], winAmount: 40, coin: 40 }
  ]

  for (const testCase of cases) {
    const { status, body } = await settle({
      bets: [{ playKey: testCase.playKey, tabId: testCase.tabId, betCode: testCase.betCode, coin: testCase.coin }],
      openCode: testCase.openCode
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
  section('三星直選（依命中位數分層）')

  const topTier = await settle({ poolBets: [{ picks: [1, 2, 3], coin: 10 }], openCode: [1, 2, 3] })
  const topRow = topTier.body?.settledRows?.[0]
  ok(
    '命中3個位置（全對）→ 頭獎（彩池比例＋最低保障 20000，只驗證分層與門檻）',
    topTier.status === 200 && topRow?.matchCount === 3 && topRow?.tierName === '頭獎' && Number(topRow?.winAmount) >= 20000,
    JSON.stringify(topRow)
  )

  const secondTier = await settle({ poolBets: [{ picks: [1, 2, 9], coin: 10 }], openCode: [1, 2, 3] })
  const secondRow = secondTier.body?.settledRows?.[0]
  ok(
    '命中2個位置（百十對，個位錯）→ 二獎（彩池比例，只驗證分層與正派彩，不驗證精確金額）',
    secondTier.status === 200 && secondRow?.matchCount === 2 && secondRow?.tierName === '二獎' && Number(secondRow?.winAmount) > 0,
    JSON.stringify(secondRow)
  )

  const fixedTier = await settle({ poolBets: [{ picks: [1, 8, 9], coin: 25 }], openCode: [1, 2, 3] })
  const fixedRow = fixedTier.body?.settledRows?.[0]
  ok(
    '命中1個位置 → 三獎（固定倍數，可精確驗證：2 × 25 = 50）',
    fixedTier.status === 200 && fixedRow?.matchCount === 1 && fixedRow?.tierName === '三獎' && Number(fixedRow?.winAmount) === 50,
    JSON.stringify(fixedRow)
  )

  const noHit = await settle({ poolBets: [{ picks: [8, 9, 0], coin: 10 }], openCode: [1, 2, 3] })
  const noHitRow = noHit.body?.settledRows?.[0]
  ok(
    '完全不中 → lose、0 個位置命中',
    noHit.status === 200 && noHitRow?.matchCount === 0 && noHitRow?.winStatus === 'lose' && Number(noHitRow?.winAmount) === 0,
    JSON.stringify(noHitRow)
  )
}

async function testPoolAndJackpotSafety() {
  section('彩池與爆池安全性（驗證測試不會污染正式 carryPool／carryJackpot）')

  const jackpotResult = await settle({
    bets: [{ playKey: 'dingwei', tabId: 181101010, betCode: '百位7', coin: 1000 }],
    openCode: [7, 7, 7]
  })
  ok('豹子開獎結算成功（觸發全站爆池條件）', jackpotResult.status === 200 && jackpotResult.body?.settledRows?.[0]?.winStatus === 'win', JSON.stringify(jackpotResult.body?.settledRows?.[0]))
  ok(
    '測試工具回報：若沒有快照還原機制，carryJackpot 真的會被覆寫成不同的值',
    Number(jackpotResult.body?.carryJackpot?.before) !== Number(jackpotResult.body?.carryJackpot?.wouldHaveChangedToWithoutGuard),
    JSON.stringify(jackpotResult.body?.carryJackpot)
  )
  ok(
    '測試工具回報：還原後的 carryJackpot 等於呼叫前的快照',
    Number(jackpotResult.body?.carryJackpot?.restoredTo) === Number(jackpotResult.body?.carryJackpot?.before),
    JSON.stringify(jackpotResult.body?.carryJackpot)
  )

  const poolResult = await settle({ poolBets: [{ picks: [4, 5, 6], coin: 10 }], openCode: [4, 5, 6] })
  ok(
    '三星直選頭獎測試也會讓 carryPool 的計算結果不同（驗證風險存在）',
    Number(poolResult.body?.carryPool?.before) !== Number(poolResult.body?.carryPool?.wouldHaveChangedToWithoutGuard),
    JSON.stringify(poolResult.body?.carryPool)
  )
  ok(
    '三星直選頭獎測試後 carryPool 仍正確還原',
    Number(poolResult.body?.carryPool?.restoredTo) === Number(poolResult.body?.carryPool?.before),
    JSON.stringify(poolResult.body?.carryPool)
  )
}

async function testIdempotency() {
  section('已結算期別不重複結算（冪等性）')
  const reuseIssue = `TEST-FC3D-IDEMPOTENT-${Date.now()}`

  const first = await settle(
    { bets: [{ playKey: 'dingwei', tabId: 181101010, betCode: '百位7', coin: 100 }], openCode: [7, 3, 3] },
    reuseIssue
  )
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：可領金額正確（960）', Number(first.body?.claimable?.amount) === 960)

  const second = await settle(
    { bets: [{ playKey: 'dingwei', tabId: 181101010, betCode: '百位7', coin: 100 }], openCode: [7, 3, 3] },
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
  console.log('FC3D 測試腳本開始')
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
