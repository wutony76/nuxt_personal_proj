#!/usr/bin/env node
/**
 * 今彩539（D539）隨時可跑的端到端測試腳本（比照 scripts/test-dlt.mjs）。
 *
 * 用法：
 *   node scripts/test-d539.mjs                 # 預設打 http://localhost:6100
 *   BASE_URL=http://localhost:6100 node scripts/test-d539.mjs
 *   npm run test:d539
 *
 * 前提：
 *   - dev server 要跑著（`npm run dev`，預設 port 6100）
 *   - 用種子帳號 admin@example.com / 123456 登入（見 server/services/storage.ts）
 *   - 依賴兩支保留下來的管理員限定測試工具（皆不打外部官方 API，用假資料取代）：
 *       server/api/admin/d539-test-settle.post.ts —— 只測「已知開獎號 → 派彩判定」這一段
 *       server/api/admin/d539-test-draw.post.ts   —— 測「開獎＋結算」整條流程（真實下注 → 判定/派彩）
 *
 * 涵蓋範圍（對照 openspec/changes/add-tw-lottery-suite/test-plan.md 第 1 節）：
 *   1. 當期資訊格式（期別格式、4 個獎項 key/順序）
 *   2. 正常下注（單組／多組）與餘額扣款
 *   3. 拒單情境（選 4/6 個號碼、重複、超出 1–39、超過 5 組）且確認未扣款
 *   4. 4 個獎項的結算判定與派彩金額（k=5 頭獎～k=2 四獎，k<2 不中獎）
 *   5. A~E 多組同時結算、互不影響、互不稀釋
 *   6. 已結算期別不重複結算（冪等性）
 *   7. 開獎＋結算整條流程：對「真正的」currentIssue 下注 → 模擬開獎 → 驗證判定，
 *      且 currentIssue／狀態完全不受測試影響（比照 dlt.ts 的既有防護原則）
 *
 * ⚠️ 這支腳本會留下測試紀錄（不清除、也不需要清除，`recordOpenCode` 等假資料一律帶
 * 「（測試）」後綴以便和真實開獎紀錄分辨）；所有測試都刻意設計成**絕不會**讓真正的
 * `currentIssue`／`cutoffAt`／`drawAt`／`lastKnownOfficialPeriod` 改變。
 */

import { createTestRunner } from './_test-utils.mjs'

const { baseUrl: BASE_URL, api, ok, section, login, summary, waitForOpen } = createTestRunner()

const LOTTERY_ID = 11003
const LOTTERY_KEY = 'D539'

async function getCoin() {
  const { body } = await api(`/api/lottery/userInfo?lottery=${LOTTERY_KEY}`)
  return Number(body?.coin ?? NaN)
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery-tw/d539/current')
  ok('current API 回 200', status === 200)
  ok('issue 對齊官方期別格式（民國年 3 碼＋該年度序號 6 碼）', /^\d{3}\d{6}$/.test(String(body?.issue ?? '')), body?.issue)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('quotaIssueMaxBets = quotaIssueMaxCoin / 50', body?.quotaIssueMaxBets === Math.floor(Number(body?.quotaIssueMaxCoin) / 50))
  ok('tiers 剛好 4 個獎項', Array.isArray(body?.tiers) && body.tiers.length === 4)
  const expectedKeys = ['d539JackpotAssign', 'd539SecondAssign', 'd539ThirdAssign', 'd539FourthAssign']
  ok('4 個獎項 key 與順序正確', JSON.stringify((body?.tiers ?? []).map((t) => t.key)) === JSON.stringify(expectedKeys))
}

async function testBetting() {
  section('下注與拒單')
  await waitForOpen('/api/lottery-tw/d539/current')
  const before = await getCoin()

  const okBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: LOTTERY_ID, key: LOTTERY_KEY },
      amount: 50,
      slots: [{ numbers: [1, 2, 3, 4, 5] }]
    })
  })
  ok('單組下注成功（5 個號碼）', okBet.status === 200 && okBet.body?.orders?.length === 1, JSON.stringify(okBet.body))

  const multiBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: LOTTERY_ID, key: LOTTERY_KEY },
      amount: 50,
      slots: [{ numbers: [6, 7, 8, 9, 10] }, { numbers: [11, 12, 13, 14, 15] }]
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
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: 50, slots: [{ numbers: [1, 2, 3, 4] }] })
  })
  ok('拒單：只選 4 個號碼（非 5）→ 400', tooFew.status === 400)

  const tooMany = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: 50, slots: [{ numbers: [1, 2, 3, 4, 5, 6] }] })
  })
  ok('拒單：選 6 個號碼（非 5）→ 400', tooMany.status === 400)

  const dup = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: 50, slots: [{ numbers: [1, 1, 2, 3, 4] }] })
  })
  ok('拒單：號碼重複 → 400', dup.status === 400)

  const outOfRange = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: 50, slots: [{ numbers: [1, 2, 3, 4, 40] }] })
  })
  ok('拒單：號碼超出 1–39（40 在大樂透合法、今彩539不合法）→ 400', outOfRange.status === 400)

  const tooManySlots = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: LOTTERY_ID, key: LOTTERY_KEY },
      amount: 50,
      slots: Array.from({ length: 6 }, (_, i) => ({ numbers: [1 + i, 2 + i, 3 + i, 4 + i, 5 + i] }))
    })
  })
  ok('拒單：一次送 6 組（超過上限 5）→ 400', tooManySlots.status === 400)

  const balanceAfterRejects = await getCoin()
  ok(
    '五種拒單情境皆未扣款',
    Math.abs(balanceBeforeRejects - balanceAfterRejects) < 0.001,
    `before=${balanceBeforeRejects} after=${balanceAfterRejects}`
  )
}

async function settle(payload) {
  return api('/api/admin/d539-test-settle', { method: 'POST', body: JSON.stringify(payload) })
}

async function testTiers() {
  section('4 獎項結算判定')
  const winningNumbers = [1, 2, 3, 4, 5]

  const cases = [
    { name: '頭獎 k=5', betCode: '01,02,03,04,05', tierKey: 'd539JackpotAssign', tiers: { d539JackpotAssign: 8000000 } },
    { name: '二獎 k=4', betCode: '01,02,03,04,10', tierKey: 'd539SecondAssign', tiers: { d539SecondAssign: 20000 } },
    { name: '三獎 k=3', betCode: '01,02,03,10,11', tierKey: 'd539ThirdAssign', tiers: { d539ThirdAssign: 300 } },
    { name: '四獎 k=2', betCode: '01,02,10,11,12', tierKey: 'd539FourthAssign', tiers: { d539FourthAssign: 50 } },
    { name: '不中獎 k=1', betCode: '01,10,11,12,13', tierKey: null, tiers: {} },
    { name: '不中獎 k=0', betCode: '20,21,22,23,24', tierKey: null, tiers: {} }
  ]

  for (const testCase of cases) {
    const { status, body } = await settle({
      betCodes: [testCase.betCode],
      winningNumbers,
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
    betCodes: ['01,02,03,04,05', '01,02,30,31,32', '10,11,12,13,14'],
    winningNumbers: [1, 2, 3, 4, 5],
    tiers: { d539JackpotAssign: 5000000, d539FourthAssign: 50 }
  })
  const rows = body?.settledRows ?? []
  ok('第一組判定頭獎（k=5）', rows[0]?.tierKey === 'd539JackpotAssign' && rows[0]?.winAmount === 5000000)
  ok('第二組判定四獎（k=2）', rows[1]?.tierKey === 'd539FourthAssign' && rows[1]?.winAmount === 50)
  ok('第三組不中獎（k=0）', rows[2]?.tierKey === null && rows[2]?.winAmount === 0)
  ok(
    '可領金額為三組加總（5,000,000 + 50）不互相稀釋',
    status === 200 && Number(body?.claimable?.amount) === 5000050,
    JSON.stringify(body?.claimable)
  )
}

async function testIdempotency() {
  section('已結算期別不重複結算')
  const reuseIssue = `TEST-IDEMPOTENT-${Date.now()}`

  const first = await settle({
    betCodes: ['01,02,03,04,05'],
    winningNumbers: [1, 2, 3, 4, 5],
    tiers: { d539JackpotAssign: 8000000 },
    reuseIssue
  })
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：正確判定頭獎', first.body?.settledRows?.[0]?.tierKey === 'd539JackpotAssign')
  const recordLenAfterFirst = Number(first.body?.recordOpenCodeLength)
  const jackpotAfterFirst = Number(first.body?.lastJackpotPrize)

  const second = await settle({
    betCodes: ['01,02,03,04,05'],
    winningNumbers: [1, 2, 3, 4, 5],
    tiers: { d539JackpotAssign: 9999999 },
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
  section('開獎＋結算整條流程（真正的 currentIssue，測試不會讓真正期別推進）')
  await waitForOpen('/api/lottery-tw/d539/current')

  const before = await api('/api/lottery-tw/d539/current')
  const issueBefore = String(before.body?.issue ?? '')
  ok('取得目前真正的 currentIssue', issueBefore.length > 0, issueBefore)

  const bet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: 50, slots: [{ numbers: [4, 8, 12, 16, 20] }] })
  })
  const orderId = bet.body?.orders?.[0]?.orderId
  ok('對真正的 currentIssue 下注成功', bet.status === 200 && Boolean(orderId), JSON.stringify(bet.body))

  const draw = await api('/api/admin/d539-test-draw', {
    method: 'POST',
    body: JSON.stringify({
      winningNumbers: [4, 8, 12, 16, 20],
      tiers: { d539JackpotAssign: 8888888 },
      period: `115TEST${Date.now()}`
    })
  })
  ok('開獎+結算 API 回 200', draw.status === 200, JSON.stringify(draw.body))
  ok(
    '結算後 currentIssue 維持不變（測試不能讓真正期別跟官方序號脫鉤）',
    draw.body?.issueAfterSettlement === issueBefore,
    `before=${issueBefore} after=${draw.body?.issueAfterSettlement}`
  )
  ok(
    '結算後狀態不受測試影響（維持開盤中）',
    draw.body?.statusAfterSettlement === '開盤中',
    draw.body?.statusAfterSettlement
  )
  ok(
    'recordOpenCode 這筆測試紀錄帶「（測試）」後綴，可與真實開獎紀錄分辨',
    String(draw.body?.recordOpenCodeTail?.issue ?? '').includes('（測試）'),
    draw.body?.recordOpenCodeTail?.issue
  )

  const record = await api('/api/lottery-tw/d539/user-record')
  const settledRow = (record.body?.betHistory ?? []).find((row) => row.orderId === orderId)
  ok(
    '透過真實 /api/lottery/bet 送出的注單，經開獎+結算流程後正確判定頭獎',
    settledRow?.tierKey === 'd539JackpotAssign' && settledRow?.winAmount === 8888888,
    JSON.stringify(settledRow)
  )
}

async function main() {
  console.log(`D539 測試腳本開始，目標：${BASE_URL}`)
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
