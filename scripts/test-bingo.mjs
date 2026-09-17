#!/usr/bin/env node
/**
 * 賓果賓果（BINGO）隨時可跑的端到端測試腳本（比照 scripts/test-p3.mjs）。
 *
 * 用法：
 *   node scripts/test-bingo.mjs
 *   BASE_URL=http://localhost:6100 node scripts/test-bingo.mjs
 *   npm run test:bingo
 *
 * 前提：
 *   - dev server 要跑著（`npm run dev`，預設 port 6100，不要另開新 port）
 *   - 用種子帳號 admin@example.com / 123456 登入
 *   - 依賴兩支保留下來的管理員限定測試工具：
 *       server/api/admin/bingo-test-settle.post.ts —— 只測「已知開獎資料 → 派彩判定」這一段
 *       server/api/admin/bingo-test-draw.post.ts   —— 測「開獎＋結算」整條流程（作用在真正的 currentIssue）
 *
 * 涵蓋範圍（對照 openspec/changes/add-tw-lottery-suite/design.md Decision 6、test-plan.md 第 6 節）：
 *   1. 常數：BINGO_STAR_PAYOUT 完整表（1~10 星，共 34 組）逐格比對（透過實際結算驗證，而非直接 import TS 常數）
 *   2. 當期資訊格式
 *   3. 基本玩法拒單
 *   4. 基本玩法判定：每個星數的最高獎級／最低獎級／不中獎，8/9/10 星額外驗證「中0」安慰獎
 *   5. 超級獎號：中 order=20 才算，中其他 19 個號碼之一不算；基本玩法＋超級獎號同時下注總扣款 50、分開判定
 *   6. 猜大小／猜單雙：正常判定＋和局退款（含真實下注＋claim 驗證淨額變動為 0）
 *   7. 同一開獎結果供 4 種投注類型共用（同一期真實下注 4 種類型，結算後開獎資料一致）
 *   8. 已結算不重複（冪等性）
 *   9. 獨立性驗證：bingo.ts 不 import dlt/d539/m649/m539/p3/p4 的任何 module
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createTestRunner } from './_test-utils.mjs'

const { baseUrl: BASE_URL, api, ok, section, login, summary, waitForOpen } = createTestRunner()

const LOTTERY_ID = 11008
const LOTTERY_KEY = 'BINGO'
const BET_UNIT = 25
const SUPER_PRIZE = 1200
const BIG_SMALL_PRIZE = 150
const ODD_EVEN_PRIZE = 150

/** 逐字照抄 design.md Decision 6 的官方公開固定賠率表，用來驅動判定測試（而非直接 import TS 檔） */
const STAR_PAYOUT = {
  1: { 1: 50 },
  2: { 2: 75, 1: 25 },
  3: { 3: 500, 2: 50 },
  4: { 4: 1000, 3: 100, 2: 25 },
  5: { 5: 7500, 4: 500, 3: 50 },
  6: { 6: 25000, 5: 1000, 4: 200, 3: 25 },
  7: { 7: 80000, 6: 3000, 5: 300, 4: 50, 3: 25 },
  8: { 8: 500000, 7: 20000, 6: 1000, 5: 200, 4: 25, 0: 25 },
  9: { 9: 1000000, 8: 100000, 7: 3000, 6: 500, 5: 100, 4: 25, 0: 25 },
  10: { 10: 5000000, 9: 250000, 8: 25000, 7: 2500, 6: 250, 5: 25, 0: 25 }
}

/** 固定開獎號碼：依開球順序 1~20（order=20 的號碼＝20，即超級獎號） */
const DRAWN_NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1)
/**
 * 「必定落空」的開獎號碼（41~60），供每次對真正 currentIssue 下注後立刻結算清空用——
 * 賓果賓果的 claimableIssues 是「同一期累加」，若讓多個測試各自對同一個真正 currentIssue
 * 下注卻不立刻結算，其中一個測試的中獎金額會被後面測試的 test-draw 一起結算進同一筆
 * claimable，汙染「淨額變動」的驗證。每次真實下注測試後都立刻用這組必定不中的開獎號結算掉，
 * 確保不會有懸而未決的注單跨測試污染 claimableIssues。
 */
const NEUTRAL_DRAWN_NUMBERS = Array.from({ length: 20 }, (_, i) => 41 + i)

async function settleNeutral() {
  return api('/api/admin/bingo-test-draw', {
    method: 'POST',
    body: JSON.stringify({ winningNumbers: NEUTRAL_DRAWN_NUMBERS, lotBigSmall: '大', lotOddEven: '單' })
  })
}

/** 把目前所有可領金額全部領完，確保後續「淨額變動」的驗證不受任何殘留可領金額干擾 */
async function drainAllClaimable() {
  for (let i = 0; i < 20; i++) {
    const { body } = await api('/api/lottery-tw/bingo/claim', { method: 'POST' })
    if (!body?.ok) break
  }
}

/** 建一組「選 star 個號碼、恰好對中 hit 個」的選號：hit 個取自開出號碼（1~20），其餘取自 21~80（不會開出） */
function starNumbersFor(star, hit) {
  const inDrawn = DRAWN_NUMBERS.slice(0, hit)
  const outDrawn = Array.from({ length: star - hit }, (_, i) => 21 + i)
  return [...inDrawn, ...outDrawn]
}

async function getCoin() {
  const { body } = await api(`/api/lottery/userInfo?lottery=${LOTTERY_KEY}`)
  return Number(body?.coin ?? NaN)
}

function testIndependenceFromOtherTwGames() {
  section('獨立性驗證（design.md Decision 6，同 Decision 3/5 精神）')
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const filePath = join(__dirname, '..', 'server', 'services', 'game', 'lottery', 'tw', 'bingo.ts')
  const source = readFileSync(filePath, 'utf8')
  const forbidden = ['dlt', 'd539', 'm649', 'm539', 'p3', 'p4']
  forbidden.forEach((name) => {
    const importsIt = new RegExp(`from\\s+['"].*\\/${name}['"]|require\\(['"].*\\/${name}['"]\\)`).test(source)
    ok(`bingo.ts 原始碼沒有 import ${name}.ts 的任何 module`, !importsIt)
  })
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery-tw/bingo/current')
  ok('current API 回 200', status === 200)
  ok('issue 對齊官方期別格式（民國年 3 碼＋序號 6 碼）', /^\d{3}\d{6}$/.test(String(body?.issue ?? '')), body?.issue)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('betTypes 剛好 4 種投注類型', Array.isArray(body?.betTypes) && body.betTypes.length === 4, JSON.stringify(body?.betTypes))
  ok('cutoffAt 等於 drawAt（沒有跨日封盤等待）', Number(body?.cutoffAt) === Number(body?.drawAt))
}

async function testBetting() {
  section('基本玩法下注與拒單')
  await waitForOpen('/api/lottery-tw/bingo/current')
  const before = await getCoin()

  const goodBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: LOTTERY_ID, key: LOTTERY_KEY },
      amount: BET_UNIT,
      slots: [{ betType: 'star', star: 3, numbers: [1, 2, 3] }]
    })
  })
  ok('基本玩法（3 星）下注成功', goodBet.status === 200 && goodBet.body?.orders?.length === 1, JSON.stringify(goodBet.body))

  const afterGoodBet = await getCoin()
  ok('扣款 25 元', Math.abs((before - afterGoodBet) - BET_UNIT) < 0.001, `before=${before} after=${afterGoodBet}`)

  // 立刻結算清空（必定落空的開獎號），避免這筆真實注單懸而未決，汙染後面測試的 claimableIssues
  await settleNeutral()

  const balanceBeforeRejects = await getCoin()

  const starMismatch = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_UNIT, slots: [{ betType: 'star', star: 5, numbers: [1, 2, 3] }] })
  })
  ok('拒單：宣告 5 星但只選 3 個號碼 → 400', starMismatch.status === 400)

  const outOfRange = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_UNIT, slots: [{ betType: 'star', star: 1, numbers: [81] }] })
  })
  ok('拒單：號碼超出 01~80（81）→ 400', outOfRange.status === 400)

  const dup = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_UNIT, slots: [{ betType: 'star', star: 2, numbers: [5, 5] }] })
  })
  ok('拒單：選號重複 → 400', dup.status === 400)

  const badPick = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_UNIT, slots: [{ betType: 'bigSmall', pick: '不知道' }] })
  })
  ok('拒單：猜大小選項不合法 → 400', badPick.status === 400)

  const tooManySlots = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: LOTTERY_ID, key: LOTTERY_KEY },
      amount: BET_UNIT,
      slots: Array.from({ length: 11 }, () => ({ betType: 'bigSmall', pick: '大' }))
    })
  })
  ok('拒單：一次送 11 組（超過上限 10）→ 400', tooManySlots.status === 400)

  const balanceAfterRejects = await getCoin()
  ok(
    '四種拒單情境皆未扣款',
    Math.abs(balanceBeforeRejects - balanceAfterRejects) < 0.001,
    `before=${balanceBeforeRejects} after=${balanceAfterRejects}`
  )
}

async function settle(payload) {
  return api('/api/admin/bingo-test-settle', { method: 'POST', body: JSON.stringify(payload) })
}

async function testStarPayoutTable() {
  section('基本玩法判定：BINGO_STAR_PAYOUT 完整表逐格驗證（1~10 星，共 34 組）')
  for (const star of Object.keys(STAR_PAYOUT).map(Number)) {
    const table = STAR_PAYOUT[star]
    for (const hit of Object.keys(table).map(Number)) {
      const expected = table[hit]
      const numbers = starNumbersFor(star, hit)
      const { status, body } = await settle({
        bets: [{ betType: 'star', star, numbers }],
        winningNumbers: DRAWN_NUMBERS,
        lotBigSmall: '大',
        lotOddEven: '單'
      })
      const row = body?.settledRows?.[0]
      ok(
        `${star} 星中 ${hit} 個 → 派彩 ${expected} 元`,
        status === 200 && row?.winStatus === 'win' && Number(row?.winAmount) === expected,
        JSON.stringify(row)
      )
    }
    // 沒中獎情境：挑一個不在表中的對中數（若該星數最低對中門檻 > 0，則 0 個對中應該不中獎；
    // 8/9/10 星表中已有 0 這個安慰獎 key，改驗證「星數-1」這個必然不在表中的對中數」
    const hitsInTable = Object.keys(table).map(Number)
    const missHit = star > 1 ? Math.min(...hitsInTable) - 1 : -1
    if (missHit >= 0 && !hitsInTable.includes(missHit)) {
      const numbers = starNumbersFor(star, missHit)
      const { status, body } = await settle({
        bets: [{ betType: 'star', star, numbers }],
        winningNumbers: DRAWN_NUMBERS,
        lotBigSmall: '大',
        lotOddEven: '單'
      })
      const row = body?.settledRows?.[0]
      ok(`${star} 星中 ${missHit} 個（查無對應對中數）→ 不中獎`, status === 200 && row?.winStatus === 'lose' && Number(row?.winAmount) === 0, JSON.stringify(row))
    }
  }
}

async function testSuperNumber() {
  section('超級獎號（依開球順序 order=20 判定，非集合判定）')

  const hitSuper = await settle({
    bets: [{ betType: 'super', number: 20 }],
    winningNumbers: DRAWN_NUMBERS,
    lotBigSmall: '大',
    lotOddEven: '單'
  })
  const hitRow = hitSuper.body?.settledRows?.[0]
  ok(`選中第 20 個開出的號碼（20）→ 派彩 ${SUPER_PRIZE}`, hitSuper.status === 200 && hitRow?.winStatus === 'win' && Number(hitRow?.winAmount) === SUPER_PRIZE, JSON.stringify(hitRow))

  const inSetNotOrder20 = await settle({
    bets: [{ betType: 'super', number: 5 }],
    winningNumbers: DRAWN_NUMBERS,
    lotBigSmall: '大',
    lotOddEven: '單'
  })
  const notOrder20Row = inSetNotOrder20.body?.settledRows?.[0]
  ok(
    '選中「有開出但不是第 20 個」的號碼（5）→ 不派彩（地雷案例：不可用集合判定）',
    inSetNotOrder20.status === 200 && notOrder20Row?.winStatus === 'lose' && Number(notOrder20Row?.winAmount) === 0,
    JSON.stringify(notOrder20Row)
  )

  const notInSet = await settle({
    bets: [{ betType: 'super', number: 50 }],
    winningNumbers: DRAWN_NUMBERS,
    lotBigSmall: '大',
    lotOddEven: '單'
  })
  const notInSetRow = notInSet.body?.settledRows?.[0]
  ok('選中完全沒開出的號碼（50）→ 不派彩', notInSet.status === 200 && notInSetRow?.winStatus === 'lose' && Number(notInSetRow?.winAmount) === 0)
}

async function testStarPlusSuperCombo() {
  section('同時下基本玩法＋超級獎號：總扣款 50，兩者分開判定')
  await waitForOpen('/api/lottery-tw/bingo/current')
  const before = await getCoin()

  const combo = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: LOTTERY_ID, key: LOTTERY_KEY },
      amount: BET_UNIT,
      slots: [
        { betType: 'star', star: 1, numbers: [1] },
        { betType: 'super', number: 1 }
      ]
    })
  })
  ok('基本玩法＋超級獎號同時下注成功（2 組）', combo.status === 200 && combo.body?.orders?.length === 2, JSON.stringify(combo.body))

  const after = await getCoin()
  ok('總扣款為 50（25+25），超級獎號為獨立加購', Math.abs((before - after) - BET_UNIT * 2) < 0.001, `before=${before} after=${after}`)

  // 立刻結算清空，避免這兩筆真實注單懸而未決，汙染後面測試的 claimableIssues
  await settleNeutral()
}

async function testBigSmallOddEven() {
  section('猜大小／猜單雙：正常判定＋和局退款')

  const bigWin = await settle({
    bets: [{ betType: 'bigSmall', pick: '大' }],
    winningNumbers: DRAWN_NUMBERS,
    lotBigSmall: '大',
    lotOddEven: '單'
  })
  const bigWinRow = bigWin.body?.settledRows?.[0]
  ok(`猜大小猜中「大」→ 派彩 ${BIG_SMALL_PRIZE}`, bigWin.status === 200 && bigWinRow?.winStatus === 'win' && Number(bigWinRow?.winAmount) === BIG_SMALL_PRIZE)

  const bigLose = await settle({
    bets: [{ betType: 'bigSmall', pick: '小' }],
    winningNumbers: DRAWN_NUMBERS,
    lotBigSmall: '大',
    lotOddEven: '單'
  })
  const bigLoseRow = bigLose.body?.settledRows?.[0]
  ok('猜大小猜錯（官方開大，猜小）→ 不中獎', bigLose.status === 200 && bigLoseRow?.winStatus === 'lose' && Number(bigLoseRow?.winAmount) === 0)

  const oddWin = await settle({
    bets: [{ betType: 'oddEven', pick: '單' }],
    winningNumbers: DRAWN_NUMBERS,
    lotBigSmall: '大',
    lotOddEven: '單'
  })
  const oddWinRow = oddWin.body?.settledRows?.[0]
  ok(`猜單雙猜中「單」→ 派彩 ${ODD_EVEN_PRIZE}`, oddWin.status === 200 && oddWinRow?.winStatus === 'win' && Number(oddWinRow?.winAmount) === ODD_EVEN_PRIZE)

  const bigTie = await settle({
    bets: [{ betType: 'bigSmall', pick: '大' }],
    winningNumbers: DRAWN_NUMBERS,
    lotBigSmall: '－',
    lotOddEven: '單'
  })
  const bigTieRow = bigTie.body?.settledRows?.[0]
  ok(
    '猜大小遇官方和局（－）→ winStatus=push，退款金額等於本金 25',
    bigTie.status === 200 && bigTieRow?.winStatus === 'push' && Number(bigTieRow?.winAmount) === BET_UNIT,
    JSON.stringify(bigTieRow)
  )

  const oddTie = await settle({
    bets: [{ betType: 'oddEven', pick: '單' }],
    winningNumbers: DRAWN_NUMBERS,
    lotBigSmall: '大',
    lotOddEven: '－'
  })
  const oddTieRow = oddTie.body?.settledRows?.[0]
  ok(
    '猜單雙遇官方和局（－）→ winStatus=push，退款金額等於本金 25',
    oddTie.status === 200 && oddTieRow?.winStatus === 'push' && Number(oddTieRow?.winAmount) === BET_UNIT,
    JSON.stringify(oddTieRow)
  )
}

async function testTieRefundNetsToZero() {
  section('和局退款：真實下注 → 開獎+結算（和局）→ 領取，淨額變動為 0')
  await waitForOpen('/api/lottery-tw/bingo/current')
  // 先把所有殘留可領金額領完，避免受之前測試的殘留 claimable 干擾「淨額變動」的驗證
  await drainAllClaimable()
  const before = await getCoin()

  const bet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({ lottery: { id: LOTTERY_ID, key: LOTTERY_KEY }, amount: BET_UNIT, slots: [{ betType: 'bigSmall', pick: '大' }] })
  })
  ok('真實下注猜大小成功', bet.status === 200 && bet.body?.orders?.length === 1, JSON.stringify(bet.body))

  const draw = await api('/api/admin/bingo-test-draw', {
    method: 'POST',
    body: JSON.stringify({ winningNumbers: DRAWN_NUMBERS, lotBigSmall: '－', lotOddEven: '單' })
  })
  ok('開獎+結算 API 回 200', draw.status === 200, JSON.stringify(draw.body))

  const claim = await api('/api/lottery-tw/bingo/claim', { method: 'POST' })
  ok('領取退款成功', claim.status === 200 && claim.body?.ok === true, JSON.stringify(claim.body))

  const after = await getCoin()
  ok('下注 -25、退款 +25，淨額變動為 0', Math.abs(before - after) < 0.001, `before=${before} after=${after}`)
}

async function testSharedDrawAcrossBetTypes() {
  section('同一期只產生一份開獎結果，4 種投注類型共用')
  await waitForOpen('/api/lottery-tw/bingo/current')

  const bet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: LOTTERY_ID, key: LOTTERY_KEY },
      amount: BET_UNIT,
      slots: [
        { betType: 'star', star: 2, numbers: [1, 2] },
        { betType: 'super', number: 20 },
        { betType: 'bigSmall', pick: '大' },
        { betType: 'oddEven', pick: '單' }
      ]
    })
  })
  ok('同一期送出 4 種投注類型成功', bet.status === 200 && bet.body?.orders?.length === 4, JSON.stringify(bet.body))
  const orderIds = (bet.body?.orders ?? []).map((o) => o.orderId)

  const draw = await api('/api/admin/bingo-test-draw', {
    method: 'POST',
    body: JSON.stringify({ winningNumbers: DRAWN_NUMBERS, lotBigSmall: '大', lotOddEven: '單' })
  })
  ok('開獎+結算 API 回 200', draw.status === 200, JSON.stringify(draw.body))

  const record = await api('/api/lottery-tw/bingo/user-record')
  const rows = orderIds.map((id) => (record.body?.betHistory ?? []).find((row) => row.orderId === id))
  ok('4 筆注單皆已結算（非 pending）', rows.every((row) => row && row.winStatus !== 'pending'), JSON.stringify(rows))

  const openCodeJson = rows.map((row) => JSON.stringify(row?.openCode ?? []))
  ok('4 筆注單的 openCode 完全一致（同一份開獎結果）', new Set(openCodeJson).size === 1, JSON.stringify(openCodeJson))

  const superNumbers = rows.map((row) => row?.superNumber)
  ok('4 筆注單的 superNumber 完全一致', new Set(superNumbers).size === 1, JSON.stringify(superNumbers))

  ok('基本玩法（2 星中 2）中獎', rows[0]?.winStatus === 'win')
  ok('超級獎號（猜中第 20 個）中獎', rows[1]?.winStatus === 'win' && Number(rows[1]?.winAmount) === SUPER_PRIZE)
  ok('猜大小（猜中大）中獎', rows[2]?.winStatus === 'win' && Number(rows[2]?.winAmount) === BIG_SMALL_PRIZE)
  ok('猜單雙（猜中單）中獎', rows[3]?.winStatus === 'win' && Number(rows[3]?.winAmount) === ODD_EVEN_PRIZE)
}

async function testIdempotency() {
  section('已結算期別不重複結算')
  const reuseIssue = `TEST-IDEMPOTENT-${Date.now()}`

  const first = await settle({
    bets: [{ betType: 'bigSmall', pick: '大' }],
    winningNumbers: DRAWN_NUMBERS,
    lotBigSmall: '大',
    lotOddEven: '單',
    reuseIssue
  })
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：正確判定中獎', first.body?.settledRows?.[0]?.winStatus === 'win')
  const recordLenAfterFirst = Number(first.body?.recordOpenCodeLength)

  const second = await settle({
    bets: [{ betType: 'bigSmall', pick: '大' }],
    winningNumbers: DRAWN_NUMBERS,
    lotBigSmall: '大',
    lotOddEven: '單',
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

async function main() {
  console.log(`BINGO 測試腳本開始，目標：${BASE_URL}`)
  testIndependenceFromOtherTwGames()
  await login()
  await testCurrentInfo()
  await testBetting()
  await testStarPayoutTable()
  await testSuperNumber()
  await testStarPlusSuperCombo()
  await testBigSmallOddEven()
  await testTieRefundNetsToZero()
  await testSharedDrawAcrossBetTypes()
  await testIdempotency()

  summary()
}

main().catch((err) => {
  console.error('測試腳本執行時發生未預期錯誤：', err)
  process.exitCode = 1
})
