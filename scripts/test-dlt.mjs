#!/usr/bin/env node
/**
 * 大樂透（DLT）隨時可跑的端到端測試腳本。
 *
 * 用法：
 *   node scripts/test-dlt.mjs                 # 預設打 http://localhost:6100
 *   BASE_URL=http://localhost:6100 node scripts/test-dlt.mjs
 *   npm run test:dlt
 *
 * 前提：
 *   - dev server 要跑著（`npm run dev`，預設 port 6100）
 *   - 用種子帳號 admin@example.com / 123456 登入（見 server/services/storage.ts）
 *   - 依賴兩支保留下來的管理員限定測試工具（皆不打外部官方 API，用假資料取代）：
 *       server/api/admin/dlt-test-settle.post.ts —— 只測「已知開獎號 → 派彩判定」這一段
 *       server/api/admin/dlt-test-draw.post.ts   —— 測「開獎＋結算」整條流程（含期別推進）
 *
 * 涵蓋範圍：
 *   1. 當期資訊格式
 *   2. 正常下注（單組／多組）與餘額扣款
 *   3. 拒單情境（號碼數不符／重複／超過 5 組）且確認未扣款
 *   4. 8 個獎項的結算判定與派彩金額（頭獎～普獎）
 *   5. 不中獎情境
 *   6. A~E 多組同時結算、互不影響、互不稀釋
 *   7. 已結算期別不重複結算（冪等性）
 *   8. 開獎＋結算整條流程：對「真正的」currentIssue 下注 → 模擬開獎觸發 _attemptSettlement →
 *      驗證注單被正確結算、currentIssue 正確推進到下一個開獎日、recordOpenCode 帶「（測試）」後綴
 *
 * ⚠️ 這支腳本會留下測試紀錄（不清除、也不需要清除，`recordOpenCode` 等假資料一律帶
 * 「（測試）」後綴以便和真實開獎紀錄分辨）；第 8 項會讓真正的 `currentIssue` 往前推進一期，
 * 這是刻意的（測試「結算後正確換下一期」本身），不是副作用錯誤。
 * 其餘測試資料都在獨立的合成期別（TEST-*）下進行，不會動到真實的 currentIssue。
 */

import { createTestRunner } from './_test-utils.mjs'

const { baseUrl: BASE_URL, api, ok, section, login, summary } = createTestRunner()

async function getCoin() {
  const { body } = await api('/api/lottery/userInfo?lottery=DLT')
  return Number(body?.coin ?? NaN)
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery-tw/dlt/current')
  ok('current API 回 200', status === 200)
  ok('issue 是純數字日期字串（不帶 DLT- 前綴）', /^\d{8}$/.test(String(body?.issue ?? '')), body?.issue)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('quotaIssueMaxBets = quotaIssueMaxCoin / 50', body?.quotaIssueMaxBets === Math.floor(Number(body?.quotaIssueMaxCoin) / 50))
  ok('tiers 剛好 8 個獎項', Array.isArray(body?.tiers) && body.tiers.length === 8)
  const expectedKeys = [
    'jackpotAssign', 'secondAssign', 'thirdAssign', 'fourthAssign',
    'fifthAssign', 'sixthAssign', 'seventhAssign', 'normalAssign'
  ]
  ok('8 個獎項 key 與順序正確', JSON.stringify((body?.tiers ?? []).map((t) => t.key)) === JSON.stringify(expectedKeys))
}

async function testBetting() {
  section('下注與拒單')
  const before = await getCoin()

  const okBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 11001, key: 'DLT' },
      amount: 50,
      slots: [{ numbers: [1, 2, 3, 4, 5, 6] }]
    })
  })
  ok('單組下注成功', okBet.status === 200 && okBet.body?.orders?.length === 1, JSON.stringify(okBet.body))

  const multiBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 11001, key: 'DLT' },
      amount: 50,
      slots: [{ numbers: [7, 8, 9, 10, 11, 12] }, { numbers: [13, 14, 15, 16, 17, 18] }]
    })
  })
  ok('雙組下注成功', multiBet.status === 200 && multiBet.body?.orders?.length === 2)

  const afterGoodBets = await getCoin()
  ok(
    '扣款金額正確（1 組 50 + 2 組 100 = 150）',
    Number.isFinite(before) && Number.isFinite(afterGoodBets) && Math.abs((before - afterGoodBets) - 150) < 0.001,
    `before=${before} after=${afterGoodBets}`
  )

  const balanceBeforeRejects = await getCoin()

  const tooFew = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: 11001, key: 'DLT' }, amount: 50, slots: [{ numbers: [1, 2, 3, 4, 5] }] })
  })
  ok('拒單：只選 5 個號碼 → 400', tooFew.status === 400)

  const dup = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: 11001, key: 'DLT' }, amount: 50, slots: [{ numbers: [1, 1, 2, 3, 4, 5] }] })
  })
  ok('拒單：號碼重複 → 400', dup.status === 400)

  const tooManySlots = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 11001, key: 'DLT' },
      amount: 50,
      slots: Array.from({ length: 6 }, (_, i) => ({ numbers: [1 + i, 2 + i, 3 + i, 4 + i, 5 + i, 6 + i] }))
    })
  })
  ok('拒單：一次送 6 組（超過上限 5）→ 400', tooManySlots.status === 400)

  const balanceAfterRejects = await getCoin()
  ok(
    '三種拒單情境皆未扣款',
    Math.abs(balanceBeforeRejects - balanceAfterRejects) < 0.001,
    `before=${balanceBeforeRejects} after=${balanceAfterRejects}`
  )
}

async function settle(payload) {
  return api('/api/admin/dlt-test-settle', { method: 'POST', body: JSON.stringify(payload) })
}

async function testTiers() {
  section('8 獎項結算判定')
  const winningNumbers = [1, 2, 3, 4, 5, 6]
  const special = 7

  const cases = [
    { name: '頭獎 k=6', betCode: '01,02,03,04,05,06', tierKey: 'jackpotAssign', tiers: { jackpotAssign: 268000000 } },
    { name: '二獎 k=5+特別號', betCode: '01,02,03,04,05,07', tierKey: 'secondAssign', tiers: { secondAssign: 5000000 } },
    { name: '三獎 k=5 不含特別號', betCode: '01,02,03,04,05,09', tierKey: 'thirdAssign', tiers: { thirdAssign: 300000 } },
    { name: '四獎 k=4+特別號', betCode: '01,02,03,04,09,07', tierKey: 'fourthAssign', tiers: { fourthAssign: 20000 } },
    { name: '五獎 k=4 不含特別號', betCode: '01,02,03,04,09,10', tierKey: 'fifthAssign', tiers: { fifthAssign: 2000 } },
    { name: '六獎 k=3+特別號', betCode: '01,02,03,09,10,07', tierKey: 'sixthAssign', tiers: { sixthAssign: 300 } },
    { name: '七獎 k=3 不含特別號', betCode: '01,02,03,09,10,11', tierKey: 'seventhAssign', tiers: { seventhAssign: 400 } },
    { name: '普獎 k=2+特別號', betCode: '01,02,09,10,11,07', tierKey: 'normalAssign', tiers: { normalAssign: 400 } },
    { name: '不中獎', betCode: '40,41,42,43,44,45', tierKey: null, tiers: {} }
  ]

  for (const testCase of cases) {
    const { status, body } = await settle({
      betCodes: [testCase.betCode],
      winningNumbers,
      special,
      tiers: testCase.tiers
    })
    const row = body?.settledRows?.[0]
    const expectedAmount = testCase.tierKey ? Number(testCase.tiers[testCase.tierKey]) : 0
    ok(
      `${testCase.name} → ${testCase.tierKey ?? '(不中獎)'}`,
      status === 200 && row?.tierKey === testCase.tierKey && Number(row?.winAmount) === expectedAmount,
      JSON.stringify(row)
    )
  }
}

async function testMultiSlotIndependence() {
  section('A~E 多組互不影響')
  const { status, body } = await settle({
    betCodes: ['01,02,03,04,05,06', '01,02,20,21,22,07', '40,41,42,43,44,45'],
    winningNumbers: [1, 2, 3, 4, 5, 6],
    special: 7,
    tiers: { jackpotAssign: 500000000, normalAssign: 400 }
  })
  const rows = body?.settledRows ?? []
  ok('第一組判定頭獎', rows[0]?.tierKey === 'jackpotAssign' && rows[0]?.winAmount === 500000000)
  ok('第二組判定普獎', rows[1]?.tierKey === 'normalAssign' && rows[1]?.winAmount === 400)
  ok('第三組不中獎', rows[2]?.tierKey === null && rows[2]?.winAmount === 0)
  ok(
    '可領金額為三組加總（500,000,000 + 400）不互相稀釋',
    status === 200 && Number(body?.claimable?.amount) === 500000400,
    JSON.stringify(body?.claimable)
  )
}

async function testIdempotency() {
  section('已結算期別不重複結算')
  const reuseIssue = `TEST-IDEMPOTENT-${Date.now()}`

  const first = await settle({
    betCodes: ['01,02,03,04,05,06'],
    winningNumbers: [1, 2, 3, 4, 5, 6],
    special: 7,
    tiers: { jackpotAssign: 111111111 },
    reuseIssue
  })
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：正確判定頭獎', first.body?.settledRows?.[0]?.tierKey === 'jackpotAssign')
  const recordLenAfterFirst = Number(first.body?.recordOpenCodeLength)
  const jackpotAfterFirst = Number(first.body?.lastJackpotPrize)

  const second = await settle({
    betCodes: ['01,02,03,04,05,06'],
    winningNumbers: [1, 2, 3, 4, 5, 6],
    special: 7,
    tiers: { jackpotAssign: 999999999 },
    reuseIssue
  })
  ok('第二次呼叫：alreadySettledBefore = true', second.body?.alreadySettledBefore === true)
  ok('第二次呼叫：新注單不會被結算（維持 pending）', second.body?.settledRows?.[0]?.winStatus === 'pending')
  ok(
    'recordOpenCode 沒有重複累積',
    Number(second.body?.recordOpenCodeLength) === recordLenAfterFirst,
    `first=${recordLenAfterFirst} second=${second.body?.recordOpenCodeLength}`
  )
  ok(
    'lastJackpotPrize 沒有被第二次的假資料覆蓋',
    Number(second.body?.lastJackpotPrize) === jackpotAfterFirst,
    `first=${jackpotAfterFirst} second=${second.body?.lastJackpotPrize}`
  )
}

async function testDrawAndSettlement() {
  section('開獎＋結算整條流程（真正的 currentIssue，會讓它推進到下一期）')

  const before = await api('/api/lottery-tw/dlt/current')
  const issueBefore = String(before.body?.issue ?? '')
  ok('取得目前真正的 currentIssue', issueBefore.length > 0, issueBefore)

  const betCode = '02,04,06,08,10,12'
  const bet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: 11001, key: 'DLT' }, amount: 50, slots: [{ numbers: [2, 4, 6, 8, 10, 12] }] })
  })
  const orderId = bet.body?.orders?.[0]?.orderId
  ok('對真正的 currentIssue 下注成功', bet.status === 200 && Boolean(orderId), JSON.stringify(bet.body))

  const draw = await api('/api/admin/dlt-test-draw', {
    method: 'POST',
    body: JSON.stringify({
      winningNumbers: [2, 4, 6, 8, 10, 12],
      special: 20,
      tiers: { jackpotAssign: 168800000 },
      period: `115TEST${Date.now()}`
    })
  })
  ok('開獎+結算 API 回 200', draw.status === 200, JSON.stringify(draw.body))
  ok(
    '結算後 currentIssue 正確推進到下一個開獎日（不等於結算前）',
    draw.body?.issueAfterSettlement && draw.body.issueAfterSettlement !== issueBefore,
    `before=${issueBefore} after=${draw.body?.issueAfterSettlement}`
  )
  ok(
    '推進後的狀態回到開盤中',
    draw.body?.statusAfterSettlement === '開盤中',
    draw.body?.statusAfterSettlement
  )
  ok(
    'recordOpenCode 這筆測試紀錄帶「（測試）」後綴，可與真實開獎紀錄分辨',
    String(draw.body?.recordOpenCodeTail?.issue ?? '').includes('（測試）'),
    draw.body?.recordOpenCodeTail?.issue
  )

  const record = await api('/api/lottery-tw/dlt/user-record')
  const settledRow = (record.body?.betHistory ?? []).find((row) => row.orderId === orderId)
  ok(
    '透過真實 /api/lottery/bet 送出的注單，經開獎+結算流程後正確判定頭獎',
    settledRow?.tierKey === 'jackpotAssign' && settledRow?.winAmount === 168800000,
    JSON.stringify(settledRow)
  )
}

async function main() {
  console.log(`DLT 測試腳本開始，目標：${BASE_URL}`)
  await login()
  await testCurrentInfo()
  await testBetting()
  await testTiers()
  await testMultiSlotIndependence()
  await testIdempotency()
  await testDrawAndSettlement()

  summary()
}

main().catch((err) => {
  console.error('測試腳本執行時發生未預期錯誤：', err)
  process.exitCode = 1
})
