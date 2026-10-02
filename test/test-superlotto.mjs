#!/usr/bin/env node
/**
 * 威力彩（SUPERLOTTO）隨時可跑的端到端測試腳本。
 *
 * 用法：
 *   node test/test-superlotto.mjs            # 預設打 http://localhost:6100
 *   BASE_URL=http://localhost:6100 node test/test-superlotto.mjs
 *   npm run test:superlotto
 *
 * 前提：
 *   - dev server 要跑著（`npm run dev`，預設 port 6100）
 *   - 用種子帳號 admin@example.com / 123456 登入（見 server/services/storage.ts）
 *   - 依賴兩支保留下來的管理員限定測試工具（皆不打外部官方 API，用假資料取代）：
 *       server/api/admin/superlotto-test-settle.post.ts —— 只測「已知兩區開獎號 → 派彩判定」這一段
 *       server/api/admin/superlotto-test-draw.post.ts   —— 測「開獎＋結算」整條流程（真實下注 → 判定/派彩）
 *
 * 涵蓋範圍（比照 test-dlt.mjs 的 6 大類結構）：
 *   1. 當期資訊格式（含「期別格式驗證」，優先執行）
 *   2. 正常下注（單組／多組、兩區）與餘額扣款（伺端固定每注 100，不受 client amount 影響）
 *   3. 拒單情境（第一區選號數不對／第二區未選／任一區超出範圍／重複／超過 5 組／金額格式錯誤）且確認未扣款
 *   4. 10 個獎項的結算判定與派彩金額（頭獎～普獎），特別含「只中第二區、第一區全空」的邊界情境
 *   5. 不中獎情境
 *   6. A~E 多組同時結算、互不影響、互不稀釋
 *   7. 已結算期別不重複結算（冪等性）
 *   8. 開獎＋結算整條流程：對「真正的」currentIssue 下注 → 模擬開獎 → 驗證正確結算，
 *      且 currentIssue／狀態完全不受測試影響
 *
 * ⚠️ 這支腳本會留下測試紀錄（不清除，帶「（測試）」後綴），且所有測試都刻意設計成**絕不會**讓
 * 真正的 currentIssue／cutoffAt／drawAt／lastKnownOfficialPeriod 改變。
 */

import { createTestRunner } from './_test-utils.mjs'

const { baseUrl: BASE_URL, api, ok, section, login, summary, waitForOpen } = createTestRunner()

const LOTTERY = { id: 11002, key: 'SUPERLOTTO' }
const BET_AMOUNT = 100

const TIER_KEYS = [
  'super638JackpotAssign', 'super638SecondAssign', 'super638ThirdAssign', 'super638FourthAssign',
  'super638FifthAssign', 'super638SixthAssign', 'super638SeventhAssign', 'super638EighthAssign',
  'super638NinthAssign', 'super638NormalAssign'
]

async function getCoin() {
  const { body } = await api('/api/lottery/userInfo?lottery=SUPERLOTTO')
  return Number(body?.coin ?? NaN)
}

function bet(slots, amount = BET_AMOUNT) {
  return api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: LOTTERY, amount, slots })
  })
}

async function testCurrentInfo() {
  section('當期資訊（含期別格式驗證，優先執行）')
  const { status, body } = await api('/api/lottery-tw/superlotto/current')
  ok('current API 回 200', status === 200)
  // 期別格式驗證：實測官方 API 確認威力彩期別＝民國年 3 碼＋該年度序號 6 碼（與大樂透同格式，例如 115000074）
  ok('issue 對齊官方期別格式（民國年 3 碼＋該年度序號 6 碼，實測與大樂透一致）',
    /^\d{3}\d{6}$/.test(String(body?.issue ?? '')), body?.issue)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('quotaIssueMaxBets = quotaIssueMaxCoin / 100', body?.quotaIssueMaxBets === Math.floor(Number(body?.quotaIssueMaxCoin) / 100))
  ok('tiers 剛好 10 個獎項', Array.isArray(body?.tiers) && body.tiers.length === 10)
  ok('10 個獎項 key 與順序正確（對齊官方 GAME_DEFS[5134].tiers）',
    JSON.stringify((body?.tiers ?? []).map((t) => t.key)) === JSON.stringify(TIER_KEYS))
  ok('popularNumbers 為兩區結構（zoneA 6 碼＋zoneB）',
    Array.isArray(body?.popularNumbers) && body.popularNumbers.length > 0
    && Array.isArray(body.popularNumbers[0]?.zoneA) && body.popularNumbers[0].zoneA.length === 6
    && typeof body.popularNumbers[0]?.zoneB === 'number',
    JSON.stringify(body?.popularNumbers?.[0]))
}

async function testBetting() {
  section('下注與拒單（兩區）')
  await waitForOpen('/api/lottery-tw/superlotto/current')
  const before = await getCoin()

  const okBet = await bet([{ zoneA: [1, 2, 3, 4, 5, 6], zoneB: 3 }])
  ok('單組下注成功', okBet.status === 200 && okBet.body?.orders?.length === 1, JSON.stringify(okBet.body))
  ok('注碼字串格式為 "第一區6碼|第二區1碼"',
    /^\d{2}(,\d{2}){5}\|\d{2}$/.test(String(okBet.body?.orders?.[0]?.betCode ?? '')),
    okBet.body?.orders?.[0]?.betCode)

  const multiBet = await bet([
    { zoneA: [7, 8, 9, 10, 11, 12], zoneB: 1 },
    { zoneA: [13, 14, 15, 16, 17, 18], zoneB: 8 }
  ])
  ok('雙組下注成功', multiBet.status === 200 && multiBet.body?.orders?.length === 2)

  const afterGoodBets = await getCoin()
  ok(
    '扣款金額正確（1 組 100 + 2 組 200 = 300）',
    Number.isFinite(before) && Number.isFinite(afterGoodBets) && Math.abs((before - afterGoodBets) - 300) < 0.001,
    `before=${before} after=${afterGoodBets}`
  )

  // 伺端固定每注 100：client 傳的 amount 只用於粗略餘額預檢，實際扣款一律 100/注
  const coinBeforeFixed = await getCoin()
  const cheatBet = await bet([{ zoneA: [1, 2, 3, 4, 5, 6], zoneB: 2 }], 50)
  const coinAfterFixed = await getCoin()
  ok('伺端固定每注 100（client 傳 amount:50 仍扣 100，不受前端金額影響）',
    cheatBet.status === 200 && Math.abs((coinBeforeFixed - coinAfterFixed) - 100) < 0.001,
    `before=${coinBeforeFixed} after=${coinAfterFixed}`)

  const balanceBeforeRejects = await getCoin()

  const zoneATooFew = await bet([{ zoneA: [1, 2, 3, 4, 5], zoneB: 3 }])
  ok('拒單：第一區只選 5 個號碼 → 400', zoneATooFew.status === 400)

  const zoneBMissing = await bet([{ zoneA: [1, 2, 3, 4, 5, 6], zoneB: null }])
  ok('拒單：第二區未選 → 400', zoneBMissing.status === 400)

  const zoneAOutOfRange = await bet([{ zoneA: [1, 2, 3, 4, 5, 39], zoneB: 3 }])
  ok('拒單：第一區超出範圍（39 > 38）→ 400', zoneAOutOfRange.status === 400)

  const zoneBOutOfRange = await bet([{ zoneA: [1, 2, 3, 4, 5, 6], zoneB: 9 }])
  ok('拒單：第二區超出範圍（9 > 8）→ 400', zoneBOutOfRange.status === 400)

  const zoneADup = await bet([{ zoneA: [1, 1, 2, 3, 4, 5], zoneB: 3 }])
  ok('拒單：第一區號碼重複 → 400', zoneADup.status === 400)

  const tooManySlots = await bet(
    Array.from({ length: 6 }, (_, i) => ({ zoneA: [1 + i, 2 + i, 3 + i, 4 + i, 5 + i, 6 + i], zoneB: 1 }))
  )
  ok('拒單：一次送 6 組（超過上限 5）→ 400', tooManySlots.status === 400)

  const badAmount = await bet([{ zoneA: [1, 2, 3, 4, 5, 6], zoneB: 3 }], 0)
  ok('拒單：金額格式錯誤（amount 0）→ 400', badAmount.status === 400)

  const balanceAfterRejects = await getCoin()
  ok(
    '七種拒單情境皆未扣款',
    Math.abs(balanceBeforeRejects - balanceAfterRejects) < 0.001,
    `before=${balanceBeforeRejects} after=${balanceAfterRejects}`
  )
}

async function settle(payload) {
  return api('/api/admin/superlotto-test-settle', { method: 'POST', body: JSON.stringify(payload) })
}

async function testTiers() {
  section('10 獎項結算判定（含「只中第二區、第一區全空」邊界）')
  // 第一區開獎號 = [1,2,3,4,5,6]、第二區開獎號 = 7
  const winningZoneA = [1, 2, 3, 4, 5, 6]
  const winningZoneB = 7

  const cases = [
    { name: '頭獎 (第一區6+第二區中)', betCode: '01,02,03,04,05,06|07', tierKey: 'super638JackpotAssign', prize: 200000000 },
    { name: '二獎 (第一區6，第二區未中)', betCode: '01,02,03,04,05,06|08', tierKey: 'super638SecondAssign', prize: 5000000 },
    { name: '三獎 (第一區5+第二區中)', betCode: '01,02,03,04,05,10|07', tierKey: 'super638ThirdAssign', prize: 150000 },
    { name: '四獎 (第一區5，第二區未中)', betCode: '01,02,03,04,05,10|08', tierKey: 'super638FourthAssign', prize: 20000 },
    { name: '五獎 (第一區4+第二區中)', betCode: '01,02,03,04,10,11|07', tierKey: 'super638FifthAssign', prize: 4000 },
    { name: '六獎 (第一區4，第二區未中)', betCode: '01,02,03,04,10,11|08', tierKey: 'super638SixthAssign', prize: 800 },
    { name: '七獎 (第一區3+第二區中)', betCode: '01,02,03,10,11,12|07', tierKey: 'super638SeventhAssign', prize: 400 },
    { name: '八獎 (第一區2+第二區中)', betCode: '01,02,10,11,12,13|07', tierKey: 'super638EighthAssign', prize: 200 },
    { name: '九獎 (第一區3，第二區未中)', betCode: '01,02,03,10,11,12|08', tierKey: 'super638NinthAssign', prize: 100 },
    { name: '普獎 (第一區1+第二區中)', betCode: '01,10,11,12,13,14|07', tierKey: 'super638NormalAssign', prize: 100 },
    { name: '普獎 (第一區全空、只中第二區)【邊界】', betCode: '10,11,12,13,14,15|07', tierKey: 'super638NormalAssign', prize: 100 },
    { name: '不中獎 (第一區2，第二區未中)', betCode: '01,02,10,11,12,13|08', tierKey: null, prize: 0 },
    { name: '不中獎 (第一區全空、第二區也未中)', betCode: '10,11,12,13,14,15|08', tierKey: null, prize: 0 }
  ]

  for (const testCase of cases) {
    const tiers = testCase.tierKey ? { [testCase.tierKey]: testCase.prize } : {}
    const { status, body } = await settle({ betCodes: [testCase.betCode], winningZoneA, winningZoneB, tiers })
    const row = body?.settledRows?.[0]
    ok(
      `${testCase.name} → ${testCase.tierKey ?? '(不中獎)'}`,
      status === 200 && row?.tierKey === testCase.tierKey && Number(row?.winAmount) === testCase.prize,
      JSON.stringify(row)
    )
  }
}

async function testMultiSlotIndependence() {
  section('A~E 多組互不影響（含第一區全空只中第二區的組）')
  const { status, body } = await settle({
    betCodes: ['01,02,03,04,05,06|07', '10,11,12,13,14,15|07', '20,21,22,23,24,25|08'],
    winningZoneA: [1, 2, 3, 4, 5, 6],
    winningZoneB: 7,
    tiers: { super638JackpotAssign: 500000000, super638NormalAssign: 100 }
  })
  const rows = body?.settledRows ?? []
  ok('第一組判定頭獎', rows[0]?.tierKey === 'super638JackpotAssign' && rows[0]?.winAmount === 500000000)
  ok('第二組（第一區全空、只中第二區）判定普獎', rows[1]?.tierKey === 'super638NormalAssign' && rows[1]?.winAmount === 100)
  ok('第三組不中獎', rows[2]?.tierKey === null && rows[2]?.winAmount === 0)
  ok(
    '可領金額為兩組加總（500,000,000 + 100）不互相稀釋',
    status === 200 && Number(body?.claimable?.amount) === 500000100,
    JSON.stringify(body?.claimable)
  )
}

async function testIdempotency() {
  section('已結算期別不重複結算')
  const reuseIssue = `TEST-IDEMPOTENT-${Date.now()}`

  const first = await settle({
    betCodes: ['01,02,03,04,05,06|07'],
    winningZoneA: [1, 2, 3, 4, 5, 6],
    winningZoneB: 7,
    tiers: { super638JackpotAssign: 111111111 },
    reuseIssue
  })
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：正確判定頭獎', first.body?.settledRows?.[0]?.tierKey === 'super638JackpotAssign')
  const recordLenAfterFirst = Number(first.body?.recordOpenCodeLength)
  const jackpotAfterFirst = Number(first.body?.lastJackpotPrize)

  const second = await settle({
    betCodes: ['01,02,03,04,05,06|07'],
    winningZoneA: [1, 2, 3, 4, 5, 6],
    winningZoneB: 7,
    tiers: { super638JackpotAssign: 999999999 },
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
  await waitForOpen('/api/lottery-tw/superlotto/current')

  const before = await api('/api/lottery-tw/superlotto/current')
  const issueBefore = String(before.body?.issue ?? '')
  ok('取得目前真正的 currentIssue', issueBefore.length > 0, issueBefore)

  const betRes = await bet([{ zoneA: [2, 4, 6, 8, 10, 12], zoneB: 3 }])
  const orderId = betRes.body?.orders?.[0]?.orderId
  ok('對真正的 currentIssue 下注成功', betRes.status === 200 && Boolean(orderId), JSON.stringify(betRes.body))

  const draw = await api('/api/admin/superlotto-test-draw', {
    method: 'POST',
    body: JSON.stringify({
      winningZoneA: [2, 4, 6, 8, 10, 12],
      winningZoneB: 3,
      tiers: { super638JackpotAssign: 168800000 },
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
  ok(
    'recordOpenCode 開獎號為 7 碼（第一區排序後 6 碼＋第二區 1 碼）',
    Array.isArray(draw.body?.recordOpenCodeTail?.openCode) && draw.body.recordOpenCodeTail.openCode.length === 7,
    JSON.stringify(draw.body?.recordOpenCodeTail?.openCode)
  )

  const record = await api('/api/lottery-tw/superlotto/user-record')
  const settledRow = (record.body?.betHistory ?? []).find((row) => row.orderId === orderId)
  ok(
    '透過真實 /api/lottery/bet 送出的注單，經開獎+結算流程後正確判定頭獎',
    settledRow?.tierKey === 'super638JackpotAssign' && settledRow?.winAmount === 168800000,
    JSON.stringify(settledRow)
  )
}

async function main() {
  console.log(`SUPERLOTTO 測試腳本開始，目標：${BASE_URL}`)
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
