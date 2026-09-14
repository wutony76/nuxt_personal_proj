#!/usr/bin/env node
/**
 * 六合彩信用盤（6HC-CD）隨時可跑的端到端測試腳本。
 *
 * 用法：
 *   npm run test:6hc-cd
 *   node scripts/test-6hc-cd.mjs
 *   BASE_URL=http://localhost:6100 node scripts/test-6hc-cd.mjs
 *
 * 前提：同其他彩種——dev server 要跑著、用種子帳號登入、依賴保留下來的
 * 管理員限定測試工具 server/api/admin/6hccd-test-settle.post.ts。
 *
 * 涵蓋範圍：
 *   1. 當期資訊格式（issue／openCode／currentStatus）
 *   2. 正常下注（特碼單號／連碼選號）與餘額扣款
 *   3. 拒單情境（連碼選號數不符／B盤低於單注下限）且確認未扣款；
 *      另外驗證「單一注碼無法辨識」這個 6HC-CD 特有的邊界：不拒單、照樣扣款，
 *      結算時視為和局全額退還（不是 400，跟其他彩種的「無效注碼一律拒單」不同）
 *   4. 18 個玩法（特碼/正碼/正碼特/連碼/七碼/五行/半波/一肖/特肖/合肖/連肖/
 *      尾數/連尾/全不中/中一/特平中/一肖量/尾數量）逐一驗證判定與賠率，
 *      含特碼 A/B 盤賠率不同（48 vs 45）、兩面開 49 視為和局退本金 兩個特殊規則
 *   5. ⚠️ 彩池共用狀態安全性：settleIssuePrize 結算尾端會無條件覆寫
 *      `this.carryJackpot`（滾存）。這裡先幫合成期別注入一筆爆池抽水、
 *      刻意讓特別號開 49（觸發爆池），驗證測試工具的「呼叫前快照、呼叫後還原」
 *      機制確實擋下了這個會永久污染正式彩池的風險
 *   6. 已結算期別不重複結算（冪等性）
 *
 * ⚠️ 五行／一肖／特肖／合肖／連肖的號碼表與賠率逐年輪轉，取決於「期別年份」
 * （期別字串前 4 碼）。這裡固定用 `2026TEST-LHCCD-*` 當合成期別，把年份釘死在
 * 2026，所有涉及年份的期望賠率（水=3.96、鼠=11.88 等）都是照 2026 年的生肖／
 * 五行表算出來的，不會因為實際執行測試的日期跨年而失準。
 *
 * ⚠️ 這支腳本會留下測試紀錄（不清除也不需要清除），所有測試期別都是獨立的合成期別
 * （`2026TEST-LHCCD-*`），不會動到真實的 currentIndex／recordOpenCode。
 */

import { createTestRunner } from './_test-utils.mjs'

const { api, ok, section, login, summary, waitForOpen } = createTestRunner()

async function getCoin() {
  const { body } = await api('/api/lottery/userInfo?lottery=LHC-CD')
  return Number(body?.coin ?? NaN)
}

async function testCurrentInfo() {
  section('當期資訊')
  const { status, body } = await api('/api/lottery/6hc-cd/current')
  ok('current API 回 200', status === 200)
  ok('issue 有值', typeof body?.issue === 'string' && body.issue.length > 0, body?.issue)
  ok('currentStatus 有值', typeof body?.currentStatus === 'string' && body.currentStatus.length > 0)
  ok('openCode 為 7 顆球', Array.isArray(body?.openCode) && body.openCode.length === 7)
}

async function testBetting() {
  section('下注與拒單')
  await waitForOpen('/api/lottery/6hc-cd/current')
  const before = await getCoin()

  const temaBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 600100, key: 'LHC-CD' },
      amount: 100,
      groups: [{ playKey: 'tema', playTypeName: '特碼', selectTabId: 2000, playList: [{ num: 7, amount: 100 }] }]
    })
  })
  ok('特碼單號下注成功', temaBet.status === 200 && temaBet.body?.orders?.length === 1, JSON.stringify(temaBet.body))

  const lianmaBet = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 600100, key: 'LHC-CD' },
      amount: 100,
      groups: [{ playKey: 'lianma', selectTabId: 6000, playList: [{ codes: [3, 15, 22], amount: 100 }] }]
    })
  })
  ok(
    '連碼（三全中）選號下注成功',
    lianmaBet.status === 200 && lianmaBet.body?.orders?.[0]?.odds === 890,
    JSON.stringify(lianmaBet.body)
  )

  const afterGoodBets = await getCoin()
  ok(
    '扣款金額正確（100 + 100 = 200）',
    Number.isFinite(before) && Number.isFinite(afterGoodBets) && Math.abs((before - afterGoodBets) - 200) < 0.001,
    `before=${before} after=${afterGoodBets}`
  )

  const balanceBeforeRejects = await getCoin()

  const comboMismatch = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 600100, key: 'LHC-CD' },
      amount: 100,
      groups: [{ playKey: 'lianma', selectTabId: 6000, playList: [{ codes: [3, 15], amount: 100 }] }]
    })
  })
  ok('拒單：三全中只選 2 個號（需 3 個）→ 400', comboMismatch.status === 400)

  const belowMinB = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 600100, key: 'LHC-CD' },
      amount: 100,
      groups: [{ playKey: 'tema', selectTabId: 2001, playList: [{ num: 7, amount: 100 }] }]
    })
  })
  ok('拒單：特碼B盤低於單注下限（300）→ 400', belowMinB.status === 400)

  const balanceAfterRejects = await getCoin()
  ok(
    '兩種拒單情境皆未扣款',
    Math.abs(balanceBeforeRejects - balanceAfterRejects) < 0.001,
    `before=${balanceBeforeRejects} after=${balanceAfterRejects}`
  )

  const balanceBeforeUnknown = await getCoin()
  const unknownCode = await api('/api/lottery/bet', {
    method: 'POST',
    body: JSON.stringify({
      lottery: { id: 600100, key: 'LHC-CD' },
      amount: 100,
      groups: [{ playKey: 'tema', selectTabId: 2000, playList: [{ label: '不存在的注碼', amount: 100 }] }]
    })
  })
  ok(
    '⚠️ 單一注碼無法辨識：不拒單（跟其他彩種不同），照樣扣款',
    unknownCode.status === 200 && unknownCode.body?.orders?.[0]?.bet_code?.[0] === '不存在的注碼',
    JSON.stringify(unknownCode.body)
  )
  const balanceAfterUnknown = await getCoin()
  ok(
    '無法辨識注碼確實照樣扣款 100',
    Math.abs((balanceBeforeUnknown - balanceAfterUnknown) - 100) < 0.001,
    `before=${balanceBeforeUnknown} after=${balanceAfterUnknown}`
  )
}

async function settle(bets, openCode, extra) {
  return api('/api/admin/6hccd-test-settle', {
    method: 'POST',
    body: JSON.stringify({ bets, openCode, ...(extra || {}) })
  })
}

async function testPlayJudging() {
  section('18 個玩法判定與派彩（含 A/B 盤賠率不同、兩面開 49 和局兩個特殊規則）')

  const cases = [
    // ── 特碼（A 盤 2000 / B 盤 2001）──
    { name: '特碼A 單號中獎', bets: [{ playKey: 'tema', tabId: 2000, betCode: '7' }], openCode: [1, 2, 3, 4, 5, 6, 7], winStatus: 'win', winAmount: 4800, odds: 48 },
    { name: '特碼B 單號中獎（賠率 45，非 A 盤的 48——A/B 盤賠率不同的陷阱）', bets: [{ playKey: 'tema', tabId: 2001, betCode: '7' }], openCode: [1, 2, 3, 4, 5, 6, 7], winStatus: 'win', winAmount: 4500, odds: 45 },
    { name: '特碼A 兩面「特大」開 49 → 和局退本金', bets: [{ playKey: 'tema', tabId: 2000, betCode: '特大' }], openCode: [1, 2, 3, 4, 5, 6, 49], winStatus: 'tie', winAmount: 100 },
    { name: '特碼A 兩面「特大」中獎（特別號 30 ≥ 25）', bets: [{ playKey: 'tema', tabId: 2000, betCode: '特大' }], openCode: [1, 2, 3, 4, 5, 6, 30], winStatus: 'win', winAmount: 198, odds: 1.98 },
    { name: '特碼A 色波「紅波」中獎', bets: [{ playKey: 'tema', tabId: 2000, betCode: '紅波' }], openCode: [1, 2, 3, 4, 5, 6, 1], winStatus: 'win', winAmount: 270, odds: 2.7 },
    { name: '特碼A 色波「紅波」不中', bets: [{ playKey: 'tema', tabId: 2000, betCode: '紅波' }], openCode: [1, 2, 3, 4, 5, 6, 3], winStatus: 'lose', winAmount: 0 },
    // ── 正碼（3000）──
    { name: '正碼 單號中獎（看 6 顆正碼，不看特別號）', bets: [{ playKey: 'zhengma', tabId: 3000, betCode: '7' }], openCode: [7, 10, 11, 12, 13, 14, 15], winStatus: 'win', winAmount: 800, odds: 8 },
    { name: '正碼 總和大 中獎（七球總和 ≥ 175）', bets: [{ playKey: 'zhengma', tabId: 3000, betCode: '總和大' }], openCode: [44, 45, 46, 47, 48, 49, 1], winStatus: 'win', winAmount: 198, odds: 1.98 },
    // ── 正碼特（正一特 4000，看 openCode[0]）──
    { name: '正碼特 單號中獎', bets: [{ playKey: 'zhengmate', tabId: 4000, betCode: '7' }], openCode: [7, 10, 11, 12, 13, 14, 15], winStatus: 'win', winAmount: 4800, odds: 48 },
    { name: '正碼特 兩面「大」該名次正碼開 49 → 和局退本金', bets: [{ playKey: 'zhengmate', tabId: 4000, betCode: '大' }], openCode: [49, 10, 11, 12, 13, 14, 15], winStatus: 'tie', winAmount: 100 },
    // ── 七碼（5000）──
    { name: '七碼「單4雙3」中獎', bets: [{ playKey: 'qima', tabId: 5000, betCode: '單4雙3' }], openCode: [1, 3, 5, 7, 2, 4, 6], winStatus: 'win', winAmount: 325, odds: 3.25 },
    { name: '七碼「單4雙3」不中（全偶數）', bets: [{ playKey: 'qima', tabId: 5000, betCode: '單4雙3' }], openCode: [2, 4, 6, 8, 10, 12, 14], winStatus: 'lose', winAmount: 0 },
    // ── 五行（7000，年份逐年輪轉，2026 年「水」12 個號）──
    { name: '五行「水」中獎（2026 年水有 12 個號，odds=0.97×49/12）', bets: [{ playKey: 'wuxing', tabId: 7000, betCode: '水' }], openCode: [10, 11, 12, 13, 14, 15, 1], winStatus: 'win', winAmount: 396, odds: 3.96 },
    // ── 半波（8000）──
    { name: '半波「紅大」中獎（紅波∩大 7 個號）', bets: [{ playKey: 'banbo', tabId: 8000, betCode: '紅大' }], openCode: [10, 11, 12, 13, 14, 15, 29], winStatus: 'win', winAmount: 679, odds: 6.79 },
    // ── 特肖（11000，只看特別號）──
    { name: '特肖「鼠」中獎（2026 年鼠 4 個號，只看特別號）', bets: [{ playKey: 'texiao', tabId: 11000, betCode: '鼠' }], openCode: [10, 11, 12, 13, 14, 15, 7], winStatus: 'win', winAmount: 1188, odds: 11.88 },
    // ── 一肖（10000 中 / 10001 不中，看 7 顆球）──
    { name: '一肖中「鼠」中獎（7 顆球任一顆出現即中）', bets: [{ playKey: 'yixiao', tabId: 10000, betCode: '鼠' }], openCode: [7, 10, 11, 12, 13, 14, 15], winStatus: 'win', winAmount: 206, odds: 2.06 },
    { name: '一肖不中「鼠」中獎（7 顆球都沒出現才中）', bets: [{ playKey: 'yixiao', tabId: 10001, betCode: '鼠' }], openCode: [10, 11, 12, 13, 14, 15, 16], winStatus: 'win', winAmount: 184, odds: 1.84 },
    // ── 合肖（13000，只看特別號，選 2 個生肖）──
    { name: '合肖「鼠、牛」中獎（特別號屬其中之一）', bets: [{ playKey: 'hexiao', tabId: 13000, betCodes: ['鼠', '牛'] }], openCode: [10, 11, 12, 13, 14, 15, 7], winStatus: 'win', winAmount: 594, odds: 5.94 },
    // ── 連肖（12000，看 7 顆球，選的生肖須全部出現）──
    { name: '連肖「鼠、牛」中獎（兩個生肖都要在 7 顆球出現過）', bets: [{ playKey: 'lianxiao', tabId: 12000, betCodes: ['鼠', '牛'] }], openCode: [7, 6, 10, 11, 12, 13, 14], winStatus: 'win', winAmount: 473, odds: 4.73 },
    // ── 尾數（15000 中 / 15001 不中）──
    { name: '尾數中「7尾」中獎', bets: [{ playKey: 'weishu', tabId: 15000, betCode: '7尾' }], openCode: [10, 11, 12, 13, 14, 15, 7], winStatus: 'win', winAmount: 951, odds: 9.51 },
    { name: '尾數不中「7尾」中獎', bets: [{ playKey: 'weishu', tabId: 15001, betCode: '7尾' }], openCode: [10, 11, 12, 13, 14, 15, 16], winStatus: 'win', winAmount: 108, odds: 1.08 },
    // ── 連尾（14000，看 7 顆球，選的尾數須全部出現）──
    { name: '連尾「1尾、2尾」中獎', bets: [{ playKey: 'lianwei', tabId: 14000, betCodes: ['1尾', '2尾'] }], openCode: [1, 2, 10, 11, 12, 13, 14], winStatus: 'win', winAmount: 338, odds: 3.38 },
    // ── 全不中（16000，選 5 個號，7 顆球都不含才中）──
    { name: '全不中（五不中）選 5 個號皆未開出 → 中獎', bets: [{ playKey: 'zixuanbuzhong', tabId: 16000, betCodes: ['1', '2', '3', '4', '5'] }], openCode: [10, 11, 12, 13, 14, 15, 16], winStatus: 'win', winAmount: 217, odds: 2.17, tierName: '五不中' },
    // ── 中一（17000，選 5 個號，至少 1 個中即中）──
    { name: '中一（五選中一）選 5 個號中 1 個 → 中獎', bets: [{ playKey: 'duoxuanzhongyi', tabId: 17000, betCodes: ['1', '2', '3', '4', '5'] }], openCode: [5, 10, 11, 12, 13, 14, 16], winStatus: 'win', winAmount: 175, odds: 1.75, tierName: '五選中一' },
    // ── 特平中（18000，選 1 個號，中即中）──
    { name: '特平中（一粒任中）選 1 個號中獎', bets: [{ playKey: 'zhengterenzhong', tabId: 18000, betCodes: ['5'] }], openCode: [5, 10, 11, 12, 13, 14, 16], winStatus: 'win', winAmount: 679, odds: 6.79, tierName: '一粒任中' },
    // ── 一肖量（19000）／尾數量（20000）：押 7 顆球涵蓋幾個生肖／幾個尾數 ──
    { name: '一肖量「4肖」中獎（7 顆球恰涵蓋 4 個生肖）', bets: [{ playKey: 'ixiaolian', tabId: 19000, betCode: '4肖' }], openCode: [7, 19, 6, 18, 5, 17, 4], winStatus: 'win', winAmount: 1668, odds: 16.68 },
    { name: '尾數量「4尾」中獎（7 顆球恰涵蓋 4 個尾數）', bets: [{ playKey: 'weishulian', tabId: 20000, betCode: '4尾' }], openCode: [1, 11, 2, 12, 3, 13, 4], winStatus: 'win', winAmount: 879, odds: 8.79 },
    // ── 未知注碼：無法辨識視為和局全額退還（結算端也要跟下注端一致）──
    { name: '無法辨識注碼結算時視為和局全額退還', bets: [{ playKey: 'tema', tabId: 2000, betCode: '不存在的注碼' }], openCode: [1, 2, 3, 4, 5, 6, 7], winStatus: 'tie', winAmount: 100 }
  ]

  for (const testCase of cases) {
    const bets = testCase.bets.map((bet) => ({ ...bet, coin: 100 }))
    const { status, body } = await settle(bets, testCase.openCode)
    const row = body?.settledRows?.[0]
    const detailOk = testCase.odds === undefined || Number(row?.odds) === testCase.odds
    const tierOk = testCase.tierName === undefined || String(row?.tierName ?? '') === testCase.tierName
    ok(
      testCase.name,
      status === 200 && row?.winStatus === testCase.winStatus && Number(row?.winAmount) === testCase.winAmount && detailOk && tierOk,
      JSON.stringify(row)
    )
  }
}

async function testLianmaTiers() {
  section('連碼多檔次優先序（三中二 / 二中特：正確依命中組成分派檔次）')

  const cases = [
    { name: '三中二 命中 3 個正碼 → 中三檔（445，非中二的 13.8）', tabId: 6001, codes: ['3', '15', '22'], openCode: [3, 15, 22, 40, 41, 42, 43], winAmount: 44500, odds: 445, tierName: '中三' },
    { name: '三中二 命中 2 個正碼 → 中二檔', tabId: 6001, codes: ['3', '15', '22'], openCode: [3, 15, 10, 11, 12, 13, 14], winAmount: 1380, odds: 13.8, tierName: '中二' },
    { name: '二中特 命中 2 個正碼（不含特別號）→ 中二檔（38）', tabId: 6003, codes: ['5', '6'], openCode: [5, 6, 10, 11, 12, 13, 14], winAmount: 3800, odds: 38, tierName: '中二' },
    { name: '二中特 命中 1 正碼＋特別號 → 中特檔（95，非中二的 38）', tabId: 6003, codes: ['5', '6'], openCode: [5, 10, 11, 12, 13, 14, 6], winAmount: 9500, odds: 95, tierName: '中特' },
    { name: '特串 命中 1 正碼＋特別號 → 特串檔', tabId: 6004, codes: ['5', '6'], openCode: [5, 10, 11, 12, 13, 14, 6], winAmount: 19000, odds: 190, tierName: '特串' },
    { name: '三全中 3 個號全在正碼 → 全中', tabId: 6000, codes: ['3', '15', '22'], openCode: [3, 15, 22, 40, 41, 42, 43], winAmount: 89000, odds: 890, tierName: '三全中' },
    { name: '二全中 2 個號全在正碼 → 全中', tabId: 6002, codes: ['5', '6'], openCode: [5, 6, 10, 11, 12, 13, 14], winAmount: 7600, odds: 76, tierName: '二全中' }
  ]

  for (const testCase of cases) {
    const { status, body } = await settle(
      [{ playKey: 'lianma', tabId: testCase.tabId, betCodes: testCase.codes, coin: 100 }],
      testCase.openCode
    )
    const row = body?.settledRows?.[0]
    ok(
      testCase.name,
      status === 200 && row?.winStatus === 'win' && Number(row?.winAmount) === testCase.winAmount &&
      Number(row?.odds) === testCase.odds && String(row?.tierName ?? '') === testCase.tierName,
      JSON.stringify(row)
    )
  }
}

async function testJackpotCarrySafety() {
  section('彩池共用狀態安全性（驗證測試不會污染正式彩池 carryJackpot）')

  const { status, body } = await settle(
    [{ playKey: 'tema', tabId: 2000, betCode: '7', coin: 100 }],
    [1, 2, 3, 4, 5, 6, 49],
    { seedIssuePool: 5000 }
  )
  ok('特別號開 49（爆池期）結算成功', status === 200, JSON.stringify(body))
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
}

async function testIdempotency() {
  section('已結算期別不重複結算（冪等性）')
  const reuseIssue = `2026TEST-LHCCD-IDEMPOTENT-${Date.now()}`

  const first = await settle(
    [{ playKey: 'zhengterenzhong', tabId: 18000, betCodes: ['5'], coin: 100 }],
    [5, 10, 11, 12, 13, 14, 16],
    { reuseIssue }
  )
  ok('首次結算：alreadySettledBefore = false', first.body?.alreadySettledBefore === false)
  ok('首次結算：可領金額正確（679）', Number(first.body?.claimable?.amount) === 679)

  const second = await settle(
    [{ playKey: 'zhengterenzhong', tabId: 18000, betCodes: ['5'], coin: 100 }],
    [5, 10, 11, 12, 13, 14, 16],
    { reuseIssue }
  )
  ok('第二次呼叫：alreadySettledBefore = true', second.body?.alreadySettledBefore === true)
  ok(
    '第二次呼叫：新注單維持 pending（不會被結算）',
    second.body?.settledRows?.[0]?.winStatus === 'pending',
    JSON.stringify(second.body?.settledRows?.[0])
  )
  ok(
    '可領金額沒有被重複疊加（維持 679，不是 1358）',
    Number(second.body?.claimable?.amount) === 679,
    `claimable=${second.body?.claimable?.amount}`
  )
}

async function main() {
  console.log('6HC-CD 測試腳本開始')
  await login()
  await testCurrentInfo()
  await testBetting()
  await testPlayJudging()
  await testLianmaTiers()
  await testJackpotCarrySafety()
  await testIdempotency()

  summary()
}

main().catch((err) => {
  console.error('測試腳本執行時發生未預期錯誤：', err)
  process.exitCode = 1
})
