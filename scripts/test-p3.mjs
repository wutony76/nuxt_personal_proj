#!/usr/bin/env node
/**
 * 3星彩（P3）隨時可跑的端到端測試腳本（比照 scripts/test-m649.mjs / test-d539.mjs）。
 *
 * 用法：
 *   node scripts/test-p3.mjs
 *   BASE_URL=http://localhost:6100 node scripts/test-p3.mjs
 *   npm run test:p3
 *
 * 前提：
 *   - dev server 要跑著（`npm run dev`，預設 port 6100，不要另開新 port）
 *   - 用種子帳號 admin@example.com / 123456 登入
 *   - 依賴兩支保留下來的管理員限定測試工具：
 *       server/api/admin/p3-test-settle.post.ts —— 只測「已知開獎號 → 派彩判定」這一段
 *       server/api/admin/p3-test-draw.post.ts   —— 測「開獎＋結算」整條流程
 *
 * 涵蓋範圍（對照 openspec/changes/add-tw-lottery-suite/design.md Decision 5、tasks.md 第 7 節）：
 *   1. 當期資訊格式（期別格式、tiers 3 個獎項 key/順序正確）
 *   2. 正彩下注中獎／不中兩種情境
 *   3. 組彩下注：3 碼互異中「二獎」、2 碼相同中「三獎」、豹子注碼應被拒絕（400）
 *   4. 前二對彩／後二對彩：各自獨立判定，同時中獎時合計派彩 1500，不可只算一次
 *   5. A~E 多組互不影響
 *   6. 已結算期別不重複結算（冪等性）
 *   7. 開獎＋結算整條流程
 *   8. 獨立性驗證：p3.ts 不 import dlt/d539/m649/m539 的任何 module
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createTestRunner } from './_test-utils.mjs'

const { baseUrl: BASE_URL, api, ok, section, login, summary, waitForOpen } = createTestRunner()

const LOTTERY_ID = 11006
const LOTTERY_KEY = 'P3'
const BET_AMOUNT = 25
const PAIR_PRIZE = 750

async function getCoin() {
  const { body } = await api(`/api/lottery/userInfo?lottery=${LOTTERY_KEY}`)
  return Number(body?.coin ?? NaN)
}

function testIndependenceFromOtherTwGames() {
  section('獨立性驗證（design.md Decision 5，同 Decision 3 精神）')
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const filePath = join(__dirname, '..', 'server', 'services', 'game', 'lottery', 'tw', 'p3.ts')
  const source = readFileSync(filePath, 'utf8')
  const forbidden = ['dlt', 'd539', 'm649', 'm539']
  forbidden.forEach((name) => {
    const importsIt = new RegExp(`from\\s+['"].*\\/${name}['"]|require\\(['"].*\\/${name}['"]\\)`).test(source)
    ok(`p3.ts 原始碼沒有 import ${name}.ts 的任何 module`, !importsIt)
  })
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery-tw/p3/current')
  ok('current API 回 200', status === 200)
  ok('issue 對齊官方期別格式（民國年 3 碼＋該年度序號 6 碼）', /^\d{3}\d{6}$/.test(String(body?.issue ?? '')), body?.issue)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('tiers 剛好 3 個獎項', Array.isArray(body?.tiers) && body.tiers.length === 3)
  const expectedKeys = ['lotto3DFirstAssign', 'lotto3DSecondAssign', 'lotto3DThirdAssign']
  ok('3 個獎項 key 與順序正確', JSON.stringify((body?.tiers ?? []).map((t) => t.key)) === JSON.stringify(expectedKeys))
}

async function testBetting() {
  section('下注與拒單')
  await waitForOpen('/api/lottery-tw/p3/current')
  const before = await getCoin()

  const zhengcai = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: LOTTERY_ID, key: LOTTERY_KEY },
      amount: BET_AMOUNT,
      slots: [{ betType: 'zhengcai', digits: [1, 2, 3] }]
    })
  })
  ok('正彩下注成功', zhengcai.status === 200 && zhengcai.body?.orders?.length === 1, JSON.stringify(zhengcai.body))

  const multiBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: LOTTERY_ID, key: LOTTERY_KEY },
      amount: BET_AMOUNT,
      slots: [
        { betType: 'zucai', digits: [4, 5, 6] },
        { betType: 'front-pair', digits: [7, 8, 9] }
      ]
    })
  })
  ok('組彩＋前二對彩雙組下注成功', multiBet.status === 200 && multiBet.body?.orders?.length === 2)

  const afterGoodBets = await getCoin()
  ok(
    '扣款金額正確（1 組 25 + 2 組 50 = 75）',
    Number.isFinite(before) && Number.isFinite(afterGoodBets) && Math.abs((before - afterGoodBets) - 75) < 0.001,
    `before=${before} after=${afterGoodBets}`
  )

  const balanceBeforeRejects = await getCoin()

  const badDigitCount = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_AMOUNT, slots: [{ betType: 'zhengcai', digits: [1, 2] }] })
  })
  ok('拒單：只選 2 位數字 → 400', badDigitCount.status === 400)

  const outOfRange = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_AMOUNT, slots: [{ betType: 'zhengcai', digits: [1, 2, 10] }] })
  })
  ok('拒單：數字超出 0~9（10）→ 400', outOfRange.status === 400)

  const badBetType = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_AMOUNT, slots: [{ betType: 'not-a-type', digits: [1, 2, 3] }] })
  })
  ok('拒單：下注方式錯誤 → 400', badBetType.status === 400)

  const groupTriple = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_AMOUNT, slots: [{ betType: 'zucai', digits: [1, 1, 1] }] })
  })
  ok('拒單：組彩豹子（3 碼全同）→ 400', groupTriple.status === 400)

  const tooManySlots = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: LOTTERY_ID, key: LOTTERY_KEY },
      amount: BET_AMOUNT,
      slots: Array.from({ length: 6 }, () => ({ betType: 'zhengcai', digits: [1, 2, 3] }))
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
  return api('/api/admin/p3-test-settle', { method: 'POST', body: JSON.stringify(payload) })
}

async function testZhengcai() {
  section('正彩判定（逐位對應完全相同）')
  const winningNumbers = [1, 2, 3]

  const win = await settle({
    bets: [{ betType: 'zhengcai', betCode: '123' }],
    winningNumbers,
    tiers: { lotto3DFirstAssign: 5000 }
  })
  const winRow = win.body?.settledRows?.[0]
  ok('正彩中獎（123 對上開獎 123）', win.status === 200 && winRow?.tierKey === 'lotto3DFirstAssign' && Number(winRow?.winAmount) === 5000, JSON.stringify(winRow))

  const lose = await settle({
    bets: [{ betType: 'zhengcai', betCode: '132' }],
    winningNumbers,
    tiers: { lotto3DFirstAssign: 5000 }
  })
  const loseRow = lose.body?.settledRows?.[0]
  ok('正彩不中（132 對上開獎 123，順序不同）', lose.status === 200 && loseRow?.tierKey === null && Number(loseRow?.winAmount) === 0, JSON.stringify(loseRow))
}

async function testZucai() {
  section('組彩判定（二獎/三獎依排列數分級）')
  const winningNumbers = [1, 2, 3]

  const secondPrize = await settle({
    bets: [{ betType: 'zucai', betCode: '321' }],
    winningNumbers,
    tiers: { lotto3DSecondAssign: 800, lotto3DThirdAssign: 300 }
  })
  const secondRow = secondPrize.body?.settledRows?.[0]
  ok(
    '組彩（3 碼互異，321 對上開獎 123）中二獎',
    secondPrize.status === 200 && secondRow?.tierKey === 'lotto3DSecondAssign' && Number(secondRow?.winAmount) === 800,
    JSON.stringify(secondRow)
  )

  const thirdWinningNumbers = [1, 1, 2]
  const thirdPrize = await settle({
    bets: [{ betType: 'zucai', betCode: '211' }],
    winningNumbers: thirdWinningNumbers,
    tiers: { lotto3DSecondAssign: 800, lotto3DThirdAssign: 300 }
  })
  const thirdRow = thirdPrize.body?.settledRows?.[0]
  ok(
    '組彩（恰有 2 碼相同，211 對上開獎 112）中三獎',
    thirdPrize.status === 200 && thirdRow?.tierKey === 'lotto3DThirdAssign' && Number(thirdRow?.winAmount) === 300,
    JSON.stringify(thirdRow)
  )

  const noMatch = await settle({
    bets: [{ betType: 'zucai', betCode: '456' }],
    winningNumbers,
    tiers: { lotto3DSecondAssign: 800, lotto3DThirdAssign: 300 }
  })
  const noMatchRow = noMatch.body?.settledRows?.[0]
  ok('組彩：數字不同（不是排列）不中獎', noMatch.status === 200 && noMatchRow?.tierKey === null && Number(noMatchRow?.winAmount) === 0)
}

async function testPairBets() {
  section('前二對彩／後二對彩（各自獨立判定，同時中獎合計 1500）')
  const winningNumbers = [1, 2, 3]

  const frontOnly = await settle({
    bets: [{ betType: 'front-pair', betCode: '129' }],
    winningNumbers,
    tiers: {}
  })
  const frontRow = frontOnly.body?.settledRows?.[0]
  ok('前二對彩中獎（前二碼 12 相同，後一碼不同）', frontOnly.status === 200 && frontRow?.tierKey === 'front-pair' && Number(frontRow?.winAmount) === PAIR_PRIZE)

  const backOnly = await settle({
    bets: [{ betType: 'back-pair', betCode: '923' }],
    winningNumbers,
    tiers: {}
  })
  const backRow = backOnly.body?.settledRows?.[0]
  ok('後二對彩中獎（後二碼 23 相同，前一碼不同）', backOnly.status === 200 && backRow?.tierKey === 'back-pair' && Number(backRow?.winAmount) === PAIR_PRIZE)

  const both = await settle({
    bets: [
      { betType: 'front-pair', betCode: '123' },
      { betType: 'back-pair', betCode: '123' }
    ],
    winningNumbers,
    tiers: {}
  })
  const bothRows = both.body?.settledRows ?? []
  const bothTotal = bothRows.reduce((sum, row) => sum + Number(row?.winAmount ?? 0), 0)
  ok(
    '同時下前二＋後二對彩（數字相同 123）都中獎，各自派彩不互相取消',
    both.status === 200 && bothRows[0]?.tierKey === 'front-pair' && bothRows[1]?.tierKey === 'back-pair',
    JSON.stringify(bothRows)
  )
  ok(`合計派彩為 ${PAIR_PRIZE * 2}（750+750），不可只算一次`, bothTotal === PAIR_PRIZE * 2, `total=${bothTotal}`)
  ok('claimable 金額也合計為 1500', Number(both.body?.claimable?.amount) === PAIR_PRIZE * 2, JSON.stringify(both.body?.claimable))
}

async function testMultiSlotIndependence() {
  section('A~E 多組互不影響')
  const winningNumbers = [1, 2, 3]
  const { status, body } = await settle({
    bets: [
      { betType: 'zhengcai', betCode: '123' },
      { betType: 'zhengcai', betCode: '456' },
      { betType: 'front-pair', betCode: '129' }
    ],
    winningNumbers,
    tiers: { lotto3DFirstAssign: 5000 }
  })
  const rows = body?.settledRows ?? []
  ok('第一組（正彩全中）判定中獎', rows[0]?.tierKey === 'lotto3DFirstAssign' && rows[0]?.winAmount === 5000)
  ok('第二組（正彩不中）不中獎', rows[1]?.tierKey === null && rows[1]?.winAmount === 0)
  ok('第三組（前二對彩中獎）獨立判定', rows[2]?.tierKey === 'front-pair' && rows[2]?.winAmount === PAIR_PRIZE)
  ok(
    '可領金額為第一、三組合計 5750，不被第二組稀釋',
    status === 200 && Number(body?.claimable?.amount) === 5000 + PAIR_PRIZE,
    JSON.stringify(body?.claimable)
  )
}

async function testIdempotency() {
  section('已結算期別不重複結算')
  const reuseIssue = `TEST-IDEMPOTENT-${Date.now()}`

  const first = await settle({
    bets: [{ betType: 'zhengcai', betCode: '123' }],
    winningNumbers: [1, 2, 3],
    tiers: { lotto3DFirstAssign: 5000 },
    reuseIssue
  })
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：正確判定中獎', first.body?.settledRows?.[0]?.tierKey === 'lotto3DFirstAssign')
  const recordLenAfterFirst = Number(first.body?.recordOpenCodeLength)

  const second = await settle({
    bets: [{ betType: 'zhengcai', betCode: '123' }],
    winningNumbers: [1, 2, 3],
    tiers: { lotto3DFirstAssign: 9999 },
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
  await waitForOpen('/api/lottery-tw/p3/current')

  const before = await api('/api/lottery-tw/p3/current')
  const issueBefore = String(before.body?.issue ?? '')
  ok('取得目前真正的 currentIssue', issueBefore.length > 0, issueBefore)

  const bet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_AMOUNT, slots: [{ betType: 'zhengcai', digits: [7, 7, 7] }] })
  })
  const orderId = bet.body?.orders?.[0]?.orderId
  ok('對真正的 currentIssue 下注成功', bet.status === 200 && Boolean(orderId), JSON.stringify(bet.body))

  const draw = await api('/api/admin/p3-test-draw', {
    method: 'POST',
    body: JSON.stringify({
      winningNumbers: [7, 7, 7],
      tiers: { lotto3DFirstAssign: 88888 },
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

  const record = await api('/api/lottery-tw/p3/user-record')
  const settledRow = (record.body?.betHistory ?? []).find((row) => row.orderId === orderId)
  ok(
    '透過真實 /api/lottery/bet 送出的注單，經開獎+結算流程後正確判定中獎',
    settledRow?.tierKey === 'lotto3DFirstAssign' && settledRow?.winAmount === 88888,
    JSON.stringify(settledRow)
  )
}

async function main() {
  console.log(`P3 測試腳本開始，目標：${BASE_URL}`)
  testIndependenceFromOtherTwGames()
  await login()
  await testCurrentInfo()
  await testBetting()
  await testZhengcai()
  await testZucai()
  await testPairBets()
  await testMultiSlotIndependence()
  await testIdempotency()
  await testDrawAndSettlement()

  summary()
}

main().catch((err) => {
  console.error('測試腳本執行時發生未預期錯誤：', err)
  process.exitCode = 1
})
