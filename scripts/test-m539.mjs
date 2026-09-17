#!/usr/bin/env node
/**
 * 39樂合彩（M539）隨時可跑的端到端測試腳本（比照 scripts/test-m649.mjs）。
 *
 * 用法：
 *   node scripts/test-m539.mjs
 *   BASE_URL=http://localhost:6100 node scripts/test-m539.mjs
 *   npm run test:m539
 *
 * 前提：
 *   - dev server 要跑著（`npm run dev`，預設 port 6100）
 *   - 用種子帳號 admin@example.com / 123456 登入
 *   - 依賴兩支保留下來的管理員限定測試工具：
 *       server/api/admin/m539-test-settle.post.ts —— 只測「已知開獎號 → 派彩判定」這一段
 *       server/api/admin/m539-test-draw.post.ts   —— 測「開獎＋結算」整條流程
 *
 * 涵蓋範圍（對照 openspec/changes/add-tw-lottery-suite/test-plan.md 第 2 節「49樂合彩／39樂合彩」）：
 *   1. 當期資訊格式（期別格式、3 個獎項 key/順序）
 *   2. 正常下注（2/3/4 合）與拒單（合數不對／重複／超出 1–39／超過 5 組）
 *   3. isHit 判定：選 2/3/4 個號碼時，全中／缺一個未中兩種情境
 *   4. A~E 多組互不影響
 *   5. 已結算期別不重複結算（冪等性）
 *   6. 開獎＋結算整條流程
 *   7. 獨立性驗證：m539.ts 不 import D539／M649／DLT 的任何 module（見 design.md Decision 3）
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createTestRunner } from './_test-utils.mjs'

const { baseUrl: BASE_URL, api, ok, section, login, summary, waitForOpen } = createTestRunner()

const LOTTERY_ID = 11005
const LOTTERY_KEY = 'M539'
const BET_AMOUNT = 25
/** 39樂合彩跟隨今彩539，一期開 5 個號碼（M649 跟隨大樂透是 6 個） */
const DRAW_COUNT = 5

async function getCoin() {
  const { body } = await api(`/api/lottery/userInfo?lottery=${LOTTERY_KEY}`)
  return Number(body?.coin ?? NaN)
}

function testIndependence() {
  section('獨立性驗證（design.md Decision 3）')
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const filePath = join(__dirname, '..', 'server', 'services', 'game', 'lottery', 'tw', 'm539.ts')
  const source = readFileSync(filePath, 'utf8')
  const importsD539 = /from\s+['"].*\/d539['"]|require\(['"].*\/d539['"]\)/.test(source)
  const importsM649 = /from\s+['"].*\/m649['"]|require\(['"].*\/m649['"]\)/.test(source)
  const importsDlt = /from\s+['"].*\/dlt['"]|require\(['"].*\/dlt['"]\)/.test(source)
  ok('m539.ts 原始碼沒有 import 今彩539（d539.ts）的任何 module', !importsD539)
  ok('m539.ts 原始碼沒有 import 49樂合彩（m649.ts）的任何 module', !importsM649)
  ok('m539.ts 原始碼沒有 import 大樂透（dlt.ts）的任何 module', !importsDlt)
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery-tw/m539/current')
  ok('current API 回 200', status === 200)
  ok('issue 對齊官方期別格式（民國年 3 碼＋該年度序號 6 碼）', /^\d{3}\d{6}$/.test(String(body?.issue ?? '')), body?.issue)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('tiers 剛好 3 個獎項', Array.isArray(body?.tiers) && body.tiers.length === 3)
  const expectedKeys = ['m539TwoAssign', 'm539ThreeAssign', 'm539FourAssign']
  ok('3 個獎項 key 與順序正確', JSON.stringify((body?.tiers ?? []).map((t) => t.key)) === JSON.stringify(expectedKeys))
}

async function testBetting() {
  section('下注與拒單')
  await waitForOpen('/api/lottery-tw/m539/current')
  const before = await getCoin()

  const twoHe = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_AMOUNT, slots: [{ numbers: [1, 2] }] })
  })
  ok('二合下注成功（2 個號碼）', twoHe.status === 200 && twoHe.body?.orders?.length === 1, JSON.stringify(twoHe.body))

  const multiBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: LOTTERY_ID, key: LOTTERY_KEY },
      amount: BET_AMOUNT,
      slots: [{ numbers: [3, 4, 5] }, { numbers: [6, 7, 8, 9] }]
    })
  })
  ok('三合＋四合雙組下注成功', multiBet.status === 200 && multiBet.body?.orders?.length === 2)

  const afterGoodBets = await getCoin()
  ok(
    '扣款金額正確（1 組 25 + 2 組 50 = 75）',
    Number.isFinite(before) && Number.isFinite(afterGoodBets) && Math.abs((before - afterGoodBets) - 75) < 0.001,
    `before=${before} after=${afterGoodBets}`
  )

  const balanceBeforeRejects = await getCoin()

  const onlyOne = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_AMOUNT, slots: [{ numbers: [1] }] })
  })
  ok('拒單：只選 1 個號碼（合數不合法）→ 400', onlyOne.status === 400)

  const fiveHe = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_AMOUNT, slots: [{ numbers: [1, 2, 3, 4, 5] }] })
  })
  ok('拒單：選 5 個號碼（合數不合法，只能 2/3/4）→ 400', fiveHe.status === 400)

  const dup = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_AMOUNT, slots: [{ numbers: [1, 1] }] })
  })
  ok('拒單：號碼重複 → 400', dup.status === 400)

  const outOfRange = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_AMOUNT, slots: [{ numbers: [1, 40] }] })
  })
  ok('拒單：號碼超出 1–39（40）→ 400', outOfRange.status === 400)

  const tooManySlots = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: LOTTERY_ID, key: LOTTERY_KEY },
      amount: BET_AMOUNT,
      slots: Array.from({ length: 6 }, (_, i) => ({ numbers: [1 + i, 2 + i] }))
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
  return api('/api/admin/m539-test-settle', { method: 'POST', body: JSON.stringify(payload) })
}

async function testTiers() {
  section('isHit 判定（二合／三合／四合，全中才中獎）')
  // 39樂合彩一期 5 個號碼（跟隨今彩539，無特別號）
  const winningNumbers = [1, 2, 3, 4, 5]

  const cases = [
    { name: '二合全中', betCode: '01,02', tierKey: 'm539TwoAssign', tiers: { m539TwoAssign: 40 } },
    { name: '二合缺一個未中', betCode: '01,10', tierKey: null, tiers: {} },
    { name: '三合全中', betCode: '01,02,03', tierKey: 'm539ThreeAssign', tiers: { m539ThreeAssign: 400 } },
    { name: '三合缺一個未中', betCode: '01,02,10', tierKey: null, tiers: {} },
    { name: '四合全中', betCode: '01,02,03,04', tierKey: 'm539FourAssign', tiers: { m539FourAssign: 4000 } },
    { name: '四合缺一個未中', betCode: '01,02,03,10', tierKey: null, tiers: {} }
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
    betCodes: ['01,02', '01,02,03,30', '10,11,12'],
    winningNumbers: [1, 2, 3, 4, 5],
    tiers: { m539TwoAssign: 40, m539ThreeAssign: 400 }
  })
  const rows = body?.settledRows ?? []
  ok('第一組（二合）判定中獎', rows[0]?.tierKey === 'm539TwoAssign' && rows[0]?.winAmount === 40)
  ok('第二組（四合，缺 30）不中獎', rows[1]?.tierKey === null && rows[1]?.winAmount === 0)
  ok('第三組（三合，全部不在開獎號內）不中獎', rows[2]?.tierKey === null && rows[2]?.winAmount === 0)
  ok(
    '可領金額為第一組獨自的 40，不被其他組稀釋',
    status === 200 && Number(body?.claimable?.amount) === 40,
    JSON.stringify(body?.claimable)
  )
}

async function testIdempotency() {
  section('已結算期別不重複結算')
  const reuseIssue = `TEST-IDEMPOTENT-${Date.now()}`

  const first = await settle({
    betCodes: ['01,02'],
    winningNumbers: [1, 2, 3, 4, 5],
    tiers: { m539TwoAssign: 40 },
    reuseIssue
  })
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：正確判定中獎', first.body?.settledRows?.[0]?.tierKey === 'm539TwoAssign')
  const recordLenAfterFirst = Number(first.body?.recordOpenCodeLength)

  const second = await settle({
    betCodes: ['01,02'],
    winningNumbers: [1, 2, 3, 4, 5],
    tiers: { m539TwoAssign: 9999 },
    reuseIssue
  })
  ok('第二次呼叫：alreadySettledBefore = true', second.body?.alreadySettledBefore === true)
  ok('第二次呼叫：新注單不會被結算（維持 pending）', second.body?.settledRows?.[0]?.winStatus === 'pending')
  ok(
    'recordOpenCode 沒有重複累積',
    Number(second.body?.recordOpenCodeLength) === recordLenAfterFirst,
    `first=${recordLenAfterFirst} second=${second.body?.recordOpenCodeLength}`
  )
}

async function testDrawAndSettlement() {
  section('開獎＋結算整條流程（真正的 currentIssue，測試不會讓真正期別推進）')
  await waitForOpen('/api/lottery-tw/m539/current')

  const before = await api('/api/lottery-tw/m539/current')
  const issueBefore = String(before.body?.issue ?? '')
  ok('取得目前真正的 currentIssue', issueBefore.length > 0, issueBefore)

  const bet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_AMOUNT, slots: [{ numbers: [4, 8] }] })
  })
  const orderId = bet.body?.orders?.[0]?.orderId
  ok('對真正的 currentIssue 下注成功', bet.status === 200 && Boolean(orderId), JSON.stringify(bet.body))

  const draw = await api('/api/admin/m539-test-draw', {
    method: 'POST',
    body: JSON.stringify({
      winningNumbers: [4, 8, 12, 16, 20],
      tiers: { m539TwoAssign: 88 },
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

  const record = await api('/api/lottery-tw/m539/user-record')
  const settledRow = (record.body?.betHistory ?? []).find((row) => row.orderId === orderId)
  ok(
    '透過真實 /api/lottery/bet 送出的注單，經開獎+結算流程後正確判定中獎',
    settledRow?.tierKey === 'm539TwoAssign' && settledRow?.winAmount === 88,
    JSON.stringify(settledRow)
  )
}

async function main() {
  console.log(`M539 測試腳本開始，目標：${BASE_URL}（一期開 ${DRAW_COUNT} 個號碼）`)
  testIndependence()
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
