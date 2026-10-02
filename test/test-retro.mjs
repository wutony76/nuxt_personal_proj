#!/usr/bin/env node
/**
 * retro 遊戲中心（30 款）得分→coin 換算端到端測試腳本。
 *
 * 用法：
 *   npm run test:retro
 *   node test/test-retro.mjs
 *   BASE_URL=http://localhost:6100 node test/test-retro.mjs
 *
 * 前提：
 *   - dev server 要跑著（`npm run dev`，預設 port 6100）
 *   - 用種子帳號 admin@example.com / 123456 登入（見 server/services/storage.ts）
 *
 * ⚠️ 跟 bg／DLT 系列不同，這裡不需要另開 server/api/admin/*-test-settle.post.ts：
 *   POST /api/games/retro/:apiSlug/history 本身就是一般使用者權限、送分→立即結算 coin
 *   同步完成一次搞定（見 server/services/game/retro/base.ts actions.record），沒有跨盤口
 *   共用彩池那種「呼叫前快照、呼叫後還原」的風險，直接用一般登入 session 打正式端點即可。
 *
 * 測試涵蓋：
 *   1. 全部 30 款遊戲各送出一次 100~1000 分區間內的分數（固定 450 分），驗證：
 *      - 分數會被各遊戲自己的 maxReasonableScore() 正確夾住（目前只有 pong 上限 10，
 *        其餘 29 款上限都在 450 分以上、不受影響）
 *      - coin 換算公式 floor(safeScore × coinRate) 且不超過單局上限 coinCapPerRun 正確
 *      - newCoinBalance 用「上一款結算後的餘額」接續累加正確（不用每款都重新查一次餘額）
 *   2. 送出的紀錄帶 meta.tag = '（測試）'，可與真實玩家紀錄分辨；不清除、直接保留在
 *      Storage.retroGames.history（跟真實玩法共用同一個「每人每遊戲最多 50 筆」FIFO 上限，
 *      舊資料自然淘汰，不需要額外清理機制）
 *   3. 透過 GET /api/games/retro/:apiSlug/history 讀回剛剛送出的紀錄，確認真的寫入、
 *      沒被清除，且標記還在
 *
 * ⚠️ 各遊戲 coinDailyCap 目前都是 100000，同一台 dev server 長時間反覆執行這支腳本，
 * 理論上有機會讓 coinRate 較高的遊戲（如 pong／snake／connect4）在當天累積到單日上限。
 * 這裡對 coinCapped 的情境也一併容許斷言通過，不會因為長時間掛著 dev server 反覆測試
 * 而誤判失敗（跟 bg 系列腳本用 waitForOpen 避開「正在開獎中」時序問題是同樣的設計精神：
 * 讓斷言本身能容忍系統正常、預期內的狀態變化）。
 */

import { createTestRunner } from './_test-utils.mjs'
import { RETRO_GAMES } from '../shared/config/gameSlugs.js'

const { api, ok, section, login, summary } = createTestRunner()

/** 落在使用者要求的 100~1000 分區間內，固定值方便斷言可重現 */
const RAW_SCORE = 450

/**
 * 各遊戲的分數合理性上限（對照 server/services/game/retro/<key>.ts 的 maxReasonableScore()）。
 * 端點本身沒有把這個值公開出來（/api/games/retro/rates 只回 coinRate／coinCapPerRun／
 * coinDailyCap），這裡手動抄一份、要跟著遊戲原始碼一起維護。
 */
const MAX_REASONABLE_SCORE = {
  snake: 900, racing: 5000, tetriminos: 100000, match3rush: 8000, match3classic: 3200,
  pong: 10, runner: 1700, spaceShooter: 10000, minesweeper: 1200, pacman: 200000,
  spaceInvaders: 8000, solitaire: 3000, typing: 8000, breakout: 8000, orbMatch: 6000,
  battleship: 15561, '2048': 300000, flappy: 500, frogger: 5000, connect4: 900,
  whackAMole: 6000, lightsOut: 3000, towerStack: 20000, arkanoid: 20000,
  towerDefense: 300000, pinball: 30000, colorMatch: 60000, maze: 28000,
  bubbleShooter: 50000, cutTheRope: 50000
}

async function getCoin() {
  const { body } = await api('/api/lottery/userInfo')
  return Number(body?.coin ?? NaN)
}

async function fetchRates() {
  const { status, body } = await api('/api/games/retro/rates')
  ok('rates API 回 200', status === 200)
  const list = Array.isArray(body?.rates) ? body.rates : []
  ok('rates 涵蓋全部 30 款 retro 遊戲', list.length === RETRO_GAMES.length, `實際 ${list.length} 款`)
  const map = {}
  list.forEach((r) => { map[r.key] = r })
  return map
}

async function testGame(game, rates, runningCoin) {
  const { key, apiSlug } = game
  const rate = rates[key]
  if (!rate) {
    ok(`${key}：rates 找得到對應設定`, false)
    return runningCoin
  }

  const maxScore = MAX_REASONABLE_SCORE[key] ?? Number.POSITIVE_INFINITY
  const safeScore = Math.min(RAW_SCORE, maxScore)
  const rawReward = Math.floor(safeScore * rate.coinRate)
  const cappedByRun = Math.min(rawReward, rate.coinCapPerRun)

  const { status, body } = await api(`/api/games/retro/${apiSlug}/history`, {
    method: 'POST',
    body: JSON.stringify({
      score: RAW_SCORE,
      meta: { tag: '（測試）', source: 'test-retro.mjs' }
    })
  })

  ok(`${key}：送分 API 回 200`, status === 200, JSON.stringify(body))
  ok(
    `${key}：分數依 maxReasonableScore 正確夾住（送出 ${RAW_SCORE} → 應為 ${safeScore}）`,
    body?.record?.score === safeScore,
    `實際 ${body?.record?.score}`
  )
  ok(`${key}：紀錄帶「（測試）」標記`, body?.record?.meta?.tag === '（測試）')

  const coinReward = Number(body?.coinReward ?? NaN)
  const withinRunCap = coinReward === cappedByRun || (body?.coinCapped === true && coinReward <= cappedByRun)
  ok(
    `${key}：coin 換算正確（floor(${safeScore} × ${rate.coinRate}) 且不超過單局上限 ${rate.coinCapPerRun}）`,
    withinRunCap,
    `預期 ${cappedByRun}、實際 ${coinReward}、coinCapped=${body?.coinCapped}`
  )

  const expectedBalance = runningCoin + coinReward
  ok(
    `${key}：newCoinBalance 正確累加（前一款結算後餘額 + 這次獲得 coin）`,
    Number(body?.newCoinBalance) === expectedBalance,
    `預期 ${expectedBalance}、實際 ${body?.newCoinBalance}`
  )

  const { status: historyStatus, body: historyBody } = await api(`/api/games/retro/${apiSlug}/history`)
  const records = Array.isArray(historyBody?.records) ? historyBody.records : []
  const found = records.find((r) => r.id === body?.record?.id)
  ok(`${key}：GET history 讀得回剛送出的測試紀錄（資料有保留、沒被清除）`, historyStatus === 200 && Boolean(found))
  ok(`${key}：讀回的紀錄仍帶「（測試）」標記`, found?.meta?.tag === '（測試）')

  return Number(body?.newCoinBalance ?? runningCoin)
}

async function main() {
  console.log('retro 系列測試腳本開始')
  await login()

  section('rates 設定清單')
  const rates = await fetchRates()

  section(`各遊戲送分與 coin 換算（${RETRO_GAMES.length} 款，均送出 ${RAW_SCORE} 分）`)
  let runningCoin = await getCoin()
  for (const game of RETRO_GAMES) {
    runningCoin = await testGame(game, rates, runningCoin)
  }

  summary()
}

main()
