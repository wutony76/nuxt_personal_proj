#!/usr/bin/env node
/**
 * 4星彩（P4）隨時可跑的端到端測試腳本（比照 scripts/test-p3.mjs / test-m649.mjs）。
 *
 * 用法：
 *   node scripts/test-p4.mjs
 *   BASE_URL=http://localhost:6100 node scripts/test-p4.mjs
 *   npm run test:p4
 *
 * 前提：
 *   - dev server 要跑著（`npm run dev`，預設 port 6100，不要另開新 port）
 *   - 用種子帳號 admin@example.com / 123456 登入
 *   - 依賴兩支保留下來的管理員限定測試工具：
 *       server/api/admin/p4-test-settle.post.ts —— 只測「已知開獎號 → 派彩判定」這一段
 *       server/api/admin/p4-test-draw.post.ts   —— 測「開獎＋結算」整條流程
 *
 * 涵蓋範圍（對照 openspec/changes/add-tw-lottery-suite/design.md Decision 5、tasks.md 第 8 節）：
 *   1. 當期資訊格式（期別格式、tiers 3 個獎項 key/順序正確）
 *   2. 正彩下注中獎／不中兩種情境
 *   3. 組彩下注：4 碼互異中「二獎」、恰一對相同／兩對相同兩種重複模式皆中「三獎」、
 *      四碼全同（豹子）應被拒絕（400）
 *   4. A~E 多組互不影響
 *   5. 已結算期別不重複結算（冪等性）
 *   6. 開獎＋結算整條流程
 *   7. 獨立性驗證：p4.ts 不 import dlt/d539/m649/m539/p3 的任何 module
 *
 * ⚠️ 組彩「有任何重複統一併入三獎」是延伸自 P3 判定原則的假設，不是 design.md 或官方文件明文
 *   規定的規則（官方只暴露 2 個組彩獎項欄位，見 shared/config/p4.ts 檔頭說明）。
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createTestRunner } from './_test-utils.mjs'

const { baseUrl: BASE_URL, api, ok, section, login, summary, waitForOpen } = createTestRunner()

const LOTTERY_ID = 11007
const LOTTERY_KEY = 'P4'
const BET_AMOUNT = 25

async function getCoin() {
  const { body } = await api(`/api/lottery/userInfo?lottery=${LOTTERY_KEY}`)
  return Number(body?.coin ?? NaN)
}

function testIndependenceFromOtherTwGames() {
  section('獨立性驗證（design.md Decision 5，同 Decision 3 精神）')
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const filePath = join(__dirname, '..', 'server', 'services', 'game', 'lottery', 'tw', 'p4.ts')
  const source = readFileSync(filePath, 'utf8')
  const forbidden = ['dlt', 'd539', 'm649', 'm539', 'p3']
  forbidden.forEach((name) => {
    const importsIt = new RegExp(`from\\s+['"].*\\/${name}['"]|require\\(['"].*\\/${name}['"]\\)`).test(source)
    ok(`p4.ts 原始碼沒有 import ${name}.ts 的任何 module`, !importsIt)
  })
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery-tw/p4/current')
  ok('current API 回 200', status === 200)
  ok('issue 對齊官方期別格式（民國年 3 碼＋該年度序號 6 碼）', /^\d{3}\d{6}$/.test(String(body?.issue ?? '')), body?.issue)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('tiers 剛好 3 個獎項', Array.isArray(body?.tiers) && body.tiers.length === 3)
  const expectedKeys = ['lotto4DFirstAssign', 'lotto4DSecondAssign', 'lotto4DThirdAssign']
  ok('3 個獎項 key 與順序正確', JSON.stringify((body?.tiers ?? []).map((t) => t.key)) === JSON.stringify(expectedKeys))
}

async function testBetting() {
  section('下注與拒單')
  await waitForOpen('/api/lottery-tw/p4/current')
  const before = await getCoin()

  const zhengcai = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: LOTTERY_ID, key: LOTTERY_KEY },
      amount: BET_AMOUNT,
      slots: [{ betType: 'zhengcai', digits: [1, 2, 3, 4] }]
    })
  })
  ok('正彩下注成功', zhengcai.status === 200 && zhengcai.body?.orders?.length === 1, JSON.stringify(zhengcai.body))

  const multiBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: LOTTERY_ID, key: LOTTERY_KEY },
      amount: BET_AMOUNT,
      slots: [
        { betType: 'zucai', digits: [4, 5, 6, 7] },
        { betType: 'zhengcai', digits: [7, 8, 9, 0] }
      ]
    })
  })
  ok('組彩＋正彩雙組下注成功', multiBet.status === 200 && multiBet.body?.orders?.length === 2)

  const afterGoodBets = await getCoin()
  ok(
    '扣款金額正確（1 組 25 + 2 組 50 = 75）',
    Number.isFinite(before) && Number.isFinite(afterGoodBets) && Math.abs((before - afterGoodBets) - 75) < 0.001,
    `before=${before} after=${afterGoodBets}`
  )

  const balanceBeforeRejects = await getCoin()

  const badDigitCount = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_AMOUNT, slots: [{ betType: 'zhengcai', digits: [1, 2, 3] }] })
  })
  ok('拒單：只選 3 位數字 → 400', badDigitCount.status === 400)

  const outOfRange = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_AMOUNT, slots: [{ betType: 'zhengcai', digits: [1, 2, 3, 10] }] })
  })
  ok('拒單：數字超出 0~9（10）→ 400', outOfRange.status === 400)

  const badBetType = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_AMOUNT, slots: [{ betType: 'front-pair', digits: [1, 2, 3, 4] }] })
  })
  ok('拒單：下注方式錯誤（4星彩沒有對彩）→ 400', badBetType.status === 400)

  const groupQuadruple = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_AMOUNT, slots: [{ betType: 'zucai', digits: [1, 1, 1, 1] }] })
  })
  ok('拒單：組彩豹子（4 碼全同）→ 400', groupQuadruple.status === 400)

  const tooManySlots = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: LOTTERY_ID, key: LOTTERY_KEY },
      amount: BET_AMOUNT,
      slots: Array.from({ length: 6 }, () => ({ betType: 'zhengcai', digits: [1, 2, 3, 4] }))
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
  return api('/api/admin/p4-test-settle', { method: 'POST', body: JSON.stringify(payload) })
}

async function testZhengcai() {
  section('正彩判定（逐位對應完全相同）')
  const winningNumbers = [1, 2, 3, 4]

  const win = await settle({
    bets: [{ betType: 'zhengcai', betCode: '1234' }],
    winningNumbers,
    tiers: { lotto4DFirstAssign: 50000 }
  })
  const winRow = win.body?.settledRows?.[0]
  ok('正彩中獎（1234 對上開獎 1234）', win.status === 200 && winRow?.tierKey === 'lotto4DFirstAssign' && Number(winRow?.winAmount) === 50000, JSON.stringify(winRow))

  const lose = await settle({
    bets: [{ betType: 'zhengcai', betCode: '1243' }],
    winningNumbers,
    tiers: { lotto4DFirstAssign: 50000 }
  })
  const loseRow = lose.body?.settledRows?.[0]
  ok('正彩不中（1243 對上開獎 1234，順序不同）', lose.status === 200 && loseRow?.tierKey === null && Number(loseRow?.winAmount) === 0, JSON.stringify(loseRow))
}

async function testZucai() {
  section('組彩判定（二獎依「4 碼互異」；三獎依「有任何重複」，涵蓋恰一對相同／兩對相同兩種模式）')
  const winningNumbers = [1, 2, 3, 4]

  const secondPrize = await settle({
    bets: [{ betType: 'zucai', betCode: '4321' }],
    winningNumbers,
    tiers: { lotto4DSecondAssign: 8000, lotto4DThirdAssign: 3000 }
  })
  const secondRow = secondPrize.body?.settledRows?.[0]
  ok(
    '組彩（4 碼互異，4321 對上開獎 1234）中二獎',
    secondPrize.status === 200 && secondRow?.tierKey === 'lotto4DSecondAssign' && Number(secondRow?.winAmount) === 8000,
    JSON.stringify(secondRow)
  )

  // 恰一對相同其餘相異：投注 1123（unique count = 3），開獎 3211 剛好是它的排列
  const onePairWinningNumbers = [3, 2, 1, 1]
  const onePairPrize = await settle({
    bets: [{ betType: 'zucai', betCode: '1123' }],
    winningNumbers: onePairWinningNumbers,
    tiers: { lotto4DSecondAssign: 8000, lotto4DThirdAssign: 3000 }
  })
  const onePairRow = onePairPrize.body?.settledRows?.[0]
  ok(
    '組彩（恰一對相同其餘相異，1123 對上開獎 3211）中三獎',
    onePairPrize.status === 200 && onePairRow?.tierKey === 'lotto4DThirdAssign' && Number(onePairRow?.winAmount) === 3000,
    JSON.stringify(onePairRow)
  )

  // 兩對相同：投注 1212（unique count = 2），開獎 2211 剛好是它的排列
  const twoPairWinningNumbers = [2, 2, 1, 1]
  const twoPairPrize = await settle({
    bets: [{ betType: 'zucai', betCode: '1212' }],
    winningNumbers: twoPairWinningNumbers,
    tiers: { lotto4DSecondAssign: 8000, lotto4DThirdAssign: 3000 }
  })
  const twoPairRow = twoPairPrize.body?.settledRows?.[0]
  ok(
    '組彩（兩對相同，1212 對上開獎 2211）也中三獎',
    twoPairPrize.status === 200 && twoPairRow?.tierKey === 'lotto4DThirdAssign' && Number(twoPairRow?.winAmount) === 3000,
    JSON.stringify(twoPairRow)
  )

  const noMatch = await settle({
    bets: [{ betType: 'zucai', betCode: '5678' }],
    winningNumbers,
    tiers: { lotto4DSecondAssign: 8000, lotto4DThirdAssign: 3000 }
  })
  const noMatchRow = noMatch.body?.settledRows?.[0]
  ok('組彩：數字不同（不是排列）不中獎', noMatch.status === 200 && noMatchRow?.tierKey === null && Number(noMatchRow?.winAmount) === 0)
}

async function testMultiSlotIndependence() {
  section('A~E 多組互不影響')
  const winningNumbers = [1, 2, 3, 4]
  const { status, body } = await settle({
    bets: [
      { betType: 'zhengcai', betCode: '1234' },
      { betType: 'zhengcai', betCode: '4567' },
      { betType: 'zucai', betCode: '4321' }
    ],
    winningNumbers,
    tiers: { lotto4DFirstAssign: 50000, lotto4DSecondAssign: 8000 }
  })
  const rows = body?.settledRows ?? []
  ok('第一組（正彩全中）判定中獎', rows[0]?.tierKey === 'lotto4DFirstAssign' && rows[0]?.winAmount === 50000)
  ok('第二組（正彩不中）不中獎', rows[1]?.tierKey === null && rows[1]?.winAmount === 0)
  ok('第三組（組彩 4 碼互異中二獎）獨立判定', rows[2]?.tierKey === 'lotto4DSecondAssign' && rows[2]?.winAmount === 8000)
  ok(
    '可領金額為第一、三組合計 58000，不被第二組稀釋',
    status === 200 && Number(body?.claimable?.amount) === 50000 + 8000,
    JSON.stringify(body?.claimable)
  )
}

async function testIdempotency() {
  section('已結算期別不重複結算')
  const reuseIssue = `TEST-IDEMPOTENT-${Date.now()}`

  const first = await settle({
    bets: [{ betType: 'zhengcai', betCode: '1234' }],
    winningNumbers: [1, 2, 3, 4],
    tiers: { lotto4DFirstAssign: 50000 },
    reuseIssue
  })
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：正確判定中獎', first.body?.settledRows?.[0]?.tierKey === 'lotto4DFirstAssign')
  const recordLenAfterFirst = Number(first.body?.recordOpenCodeLength)

  const second = await settle({
    bets: [{ betType: 'zhengcai', betCode: '1234' }],
    winningNumbers: [1, 2, 3, 4],
    tiers: { lotto4DFirstAssign: 99999 },
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
  await waitForOpen('/api/lottery-tw/p4/current')

  const before = await api('/api/lottery-tw/p4/current')
  const issueBefore = String(before.body?.issue ?? '')
  ok('取得目前真正的 currentIssue', issueBefore.length > 0, issueBefore)

  const bet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_AMOUNT, slots: [{ betType: 'zhengcai', digits: [7, 7, 7, 7] }] })
  })
  const orderId = bet.body?.orders?.[0]?.orderId
  ok('對真正的 currentIssue 下注成功', bet.status === 200 && Boolean(orderId), JSON.stringify(bet.body))

  const draw = await api('/api/admin/p4-test-draw', {
    method: 'POST',
    body: JSON.stringify({
      winningNumbers: [7, 7, 7, 7],
      tiers: { lotto4DFirstAssign: 888888 },
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

  const record = await api('/api/lottery-tw/p4/user-record')
  const settledRow = (record.body?.betHistory ?? []).find((row) => row.orderId === orderId)
  ok(
    '透過真實 /api/lottery/bet 送出的注單，經開獎+結算流程後正確判定中獎',
    settledRow?.tierKey === 'lotto4DFirstAssign' && settledRow?.winAmount === 888888,
    JSON.stringify(settledRow)
  )
}

async function main() {
  console.log(`P4 測試腳本開始，目標：${BASE_URL}`)
  testIndependenceFromOtherTwGames()
  await login()
  await testCurrentInfo()
  await testBetting()
  await testZhengcai()
  await testZucai()
  await testMultiSlotIndependence()
  await testIdempotency()
  await testDrawAndSettlement()

  summary()
}

main().catch((err) => {
  console.error('測試腳本執行時發生未預期錯誤：', err)
  process.exitCode = 1
})
