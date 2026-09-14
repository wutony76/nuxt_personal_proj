#!/usr/bin/env node
/**
 * 快樂8（KL8）隨時可跑的端到端測試腳本。
 *
 * 用法：
 *   npm run test:kl8
 *   node scripts/test-kl8.mjs
 *   BASE_URL=http://localhost:6100 node scripts/test-kl8.mjs
 *
 * 前提：同其他彩種——dev server 要跑著、用種子帳號登入、依賴保留下來的
 * 管理員限定測試工具 server/api/admin/kl8-test-settle.post.ts。
 *
 * ⚠️ KL8 只有信用盤（沒有 CD/OF 之分），全站只有一個 instance，跟 EGGS／KL10 同構：
 * 玩家看到的彩池／爆池滾存就是這個 instance 的 `carryPool`／`carryJackpot` 兩個欄位，
 * settleIssuePrize 單次呼叫就無條件覆寫，沒有其他彩種 CD/OF 成對盤口那種
 * 「等雙方交件才真的分配」的天然緩衝。測試工具對這兩者都做「呼叫前快照、
 * 呼叫後同步還原」，本腳本的「彩池與爆池安全性」段落會直接驗證這點。
 *
 * 涵蓋範圍：
 *   1. 當期資訊格式（issue／openCode，20 個 1~80 互不重複）
 *   2. 正常下注（任選／選號彩池玩法）與拒單（不存在的注碼）
 *   3. 兩個固定賠率玩法判定與賠率：任選（N 碼全中才算中）、兩面（和值八面含
 *      大單/大雙/小單/小雙複合面、上下盤、奇偶盤、五行）；以及「無法辨識注碼視為
 *      和局全額退還」的邊界（正常下注流程不可達，透過測試工具直接測）
 *   4. 選號（xuanhao）彩池玩法依命中顆數（3碼中對中幾碼）分層：頭獎/二獎
 *      （彩池比例＋頭獎最低保障，只驗證分層與 floor）、三獎（固定 2 倍，可精確驗證）
 *   5. ⚠️ 彩池與爆池安全性：驗證測試工具的「呼叫前快照、呼叫後還原」機制
 *      確實擋下了會永久污染正式 carryPool／carryJackpot 的風險
 *   6. 已結算期別不重複結算（冪等性）
 *
 * ⚠️ 這支腳本會留下測試紀錄（不清除也不需要清除），所有測試期別都是獨立的合成期別
 * （`TEST-KL8-*`），不會動到真實的 currentIndex／recordOpenCode。
 */

import { createTestRunner } from './_test-utils.mjs'

const { api, ok, section, login, summary } = createTestRunner()

// 四組固定測試開獎號（20 碼、1~80 互不重複），涵蓋大/小 × 單/雙 四種組合：
// A = 1~20（小、雙、上盤、奇偶和、五行=金）
// B = 61~80（大、雙、下盤、奇偶和、五行=土）
// C = 1~19,21（小、單、上盤、奇盤）
// D = 60,62~80（大、單、下盤、偶盤）
const SET_A = Array.from({ length: 20 }, (_, i) => i + 1)
const SET_B = Array.from({ length: 20 }, (_, i) => i + 61)
const SET_C = [...Array.from({ length: 19 }, (_, i) => i + 1), 21]
const SET_D = [60, ...Array.from({ length: 19 }, (_, i) => i + 62)]

async function getCoin() {
  const { body } = await api('/api/lottery/userInfo?lottery=KL8')
  return Number(body?.coin ?? NaN)
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery/kl8/current')
  ok('current API 回 200', status === 200)
  ok('issue 有值', typeof body?.issue === 'string' && body.issue.length > 0, body?.issue)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('openCode 為 20 個號碼', Array.isArray(body?.openCode) && body.openCode.length === 20)
}

async function testBetting() {
  section('下注與拒單')
  const before = await getCoin()

  const oddsBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 8001, key: 'KL8' },
      amount: 100,
      groups: [{ playKey: 'renxuan', playTypeName: '任選', selectTabId: 2121010, playList: [{ label: '任一中一01', amount: 100 }] }]
    })
  })
  ok('任選下注成功', oddsBet.status === 200 && oddsBet.body?.orders?.length === 1, JSON.stringify(oddsBet.body))

  const poolBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 8001, key: 'KL8' },
      amount: 10,
      groups: [{ playKey: 'xuanhao', playTypeName: '選號', playList: [{ codes: [1, 10, 20], amount: 10 }] }]
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
      lottery: { id: 8001, key: 'KL8' },
      amount: 100,
      groups: [{ playKey: 'liangmian', selectTabId: 21211, playList: [{ label: '不存在', amount: 100 }] }]
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
  return api('/api/admin/kl8-test-settle', {
    method: 'POST',
    body: JSON.stringify({ ...payload, ...(reuseIssue ? { reuseIssue } : {}) })
  })
}

async function testPlayJudging() {
  section('2 個固定賠率玩法判定與派彩')

  const cases = [
    { name: '任選「任一中一01」中獎（01在開獎20碼內）', playKey: 'renxuan', tabId: 2121010, betCode: '任一中一01', openCode: SET_A, winAmount: 388 },
    { name: '任選「任一中一21」不中（21不在開獎20碼內）', playKey: 'renxuan', tabId: 2121010, betCode: '任一中一21', openCode: SET_A, winAmount: 0 },
    { name: '任選「任三中三01,10,20」中獎（三碼皆在開獎20碼內）', playKey: 'renxuan', tabId: 2121012, betCode: '任三中三01,10,20', openCode: SET_A, winAmount: 3495, coin: 50 },
    { name: '兩面「小」中獎（總和=210<810）', playKey: 'liangmian', tabId: 21211, betCode: '小', openCode: SET_A, winAmount: 194 },
    { name: '兩面「大」不中（總和=210<810）', playKey: 'liangmian', tabId: 21211, betCode: '大', openCode: SET_A, winAmount: 0 },
    { name: '兩面「雙」中獎（總和=210為偶）', playKey: 'liangmian', tabId: 21211, betCode: '雙', openCode: SET_A, winAmount: 193 },
    { name: '兩面「小雙」中獎（總和=210，小且偶）', playKey: 'liangmian', tabId: 21211, betCode: '小雙', openCode: SET_A, winAmount: 391 },
    { name: '兩面「上盤」中獎（≤40的號碼20個 > >40的0個）', playKey: 'liangmian', tabId: 21211, betCode: '上盤', openCode: SET_A, winAmount: 243 },
    { name: '兩面「奇偶和」中獎（奇偶各10個，10:10）', playKey: 'liangmian', tabId: 21211, betCode: '奇偶和', openCode: SET_A, winAmount: 477 },
    { name: '兩面「金」中獎（總和=210≤734）', playKey: 'liangmian', tabId: 21211, betCode: '金', openCode: SET_A, winAmount: 479 },
    { name: '兩面「大」中獎（總和=1410≥810）', playKey: 'liangmian', tabId: 21211, betCode: '大', openCode: SET_B, winAmount: 193 },
    { name: '兩面「下盤」中獎（≤40的號碼0個 < >40的20個）', playKey: 'liangmian', tabId: 21211, betCode: '下盤', openCode: SET_B, winAmount: 243 },
    { name: '兩面「土」中獎（總和=1410>886）', playKey: 'liangmian', tabId: 21211, betCode: '土', openCode: SET_B, winAmount: 487 },
    { name: '兩面「大雙」中獎（總和=1410，大且偶）', playKey: 'liangmian', tabId: 21211, betCode: '大雙', openCode: SET_B, winAmount: 384 },
    { name: '兩面「小單」中獎（總和=211，小且奇）', playKey: 'liangmian', tabId: 21211, betCode: '小單', openCode: SET_C, winAmount: 388 },
    { name: '兩面「大單」中獎（總和=1409，大且奇）', playKey: 'liangmian', tabId: 21211, betCode: '大單', openCode: SET_D, winAmount: 388 },
    { name: '⚠️ 無法辨識注碼視為和局全額退還', playKey: 'liangmian', tabId: 21211, betCode: '亂碼XYZ', openCode: SET_A, winAmount: 40, coin: 40 }
  ]

  for (const testCase of cases) {
    const coin = testCase.coin ?? 100
    const { status, body } = await settle({
      bets: [{ playKey: testCase.playKey, tabId: testCase.tabId, betCode: testCase.betCode, coin }],
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
  section('選號（xuanhao）彩池玩法依命中顆數（3碼）分層')

  const topTier = await settle({ poolBets: [{ picks: [1, 10, 20], coin: 10 }], openCode: SET_A })
  const topRow = topTier.body?.settledRows?.[0]
  ok(
    '命中3顆（全對）→ 頭獎（彩池比例＋最低保障 20000，只驗證命中數與門檻）',
    topTier.status === 200 && topRow?.matchCount === 3 && Number(topRow?.winAmount) >= 20000,
    JSON.stringify(topRow)
  )

  const secondTier = await settle({ poolBets: [{ picks: [1, 10, 50], coin: 10 }], openCode: SET_A })
  const secondRow = secondTier.body?.settledRows?.[0]
  ok(
    '命中2顆 → 二獎（彩池比例，只驗證命中數與正派彩，不驗證精確金額）',
    secondTier.status === 200 && secondRow?.matchCount === 2 && Number(secondRow?.winAmount) > 0,
    JSON.stringify(secondRow)
  )

  const fixedTier = await settle({ poolBets: [{ picks: [1, 50, 60], coin: 25 }], openCode: SET_A })
  const fixedRow = fixedTier.body?.settledRows?.[0]
  ok(
    '命中1顆 → 三獎（固定倍數，可精確驗證：2 × 25 = 50）',
    fixedTier.status === 200 && fixedRow?.matchCount === 1 && Number(fixedRow?.winAmount) === 50,
    JSON.stringify(fixedRow)
  )

  const noHit = await settle({ poolBets: [{ picks: [50, 60, 70], coin: 10 }], openCode: SET_A })
  const noHitRow = noHit.body?.settledRows?.[0]
  ok(
    '完全不中 → lose、0 顆命中',
    noHit.status === 200 && noHitRow?.matchCount === 0 && noHitRow?.winStatus === 'lose' && Number(noHitRow?.winAmount) === 0,
    JSON.stringify(noHitRow)
  )
}

async function testPoolAndJackpotSafety() {
  section('彩池與爆池安全性（驗證測試不會污染正式 carryPool／carryJackpot）')

  // 20 碼中 16 奇 4 偶（奇偶一邊倒）觸發爆池
  const lopsided = [...Array.from({ length: 16 }, (_, i) => i * 2 + 1), 2, 4, 6, 8]
  const { status, body } = await settle({
    bets: [{ playKey: 'renxuan', tabId: 2121010, betCode: '任一中一01', coin: 1000 }],
    openCode: lopsided
  })
  ok('奇偶一邊倒開獎結算成功（觸發爆池條件）', status === 200 && body?.settledRows?.[0]?.winStatus === 'win', JSON.stringify(body?.settledRows?.[0]))
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

  const poolResult = await settle({ poolBets: [{ picks: [1, 2, 3], coin: 10 }], openCode: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] })
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
  const reuseIssue = `TEST-KL8-IDEMPOTENT-${Date.now()}`

  const first = await settle(
    { bets: [{ playKey: 'renxuan', tabId: 2121010, betCode: '任一中一01', coin: 100 }], openCode: SET_A },
    reuseIssue
  )
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：可領金額正確（388）', Number(first.body?.claimable?.amount) === 388)

  const second = await settle(
    { bets: [{ playKey: 'renxuan', tabId: 2121010, betCode: '任一中一01', coin: 100 }], openCode: SET_A },
    reuseIssue
  )
  ok('第二次呼叫：alreadySettledBefore = true', second.body?.alreadySettledBefore === true)
  ok(
    '第二次呼叫：新注單維持 pending（不會被結算）',
    second.body?.settledRows?.[0]?.winStatus === 'pending',
    JSON.stringify(second.body?.settledRows?.[0])
  )
  ok(
    '可領金額沒有被重複疊加（維持 388，不是 776）',
    Number(second.body?.claimable?.amount) === 388,
    `claimable=${second.body?.claimable?.amount}`
  )
}

async function main() {
  console.log('KL8 測試腳本開始')
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
