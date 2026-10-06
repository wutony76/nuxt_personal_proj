/**
 * 刮刮樂試算工具測試，見 replace-scratch-simulator-with-python-proxy。
 *
 * 這支工具直接轉呼叫使用者本機長期在跑的 Python 試算服務
 * （`SCRATCH_PY_API_BASE`，預設 http://127.0.0.1:8000），不是本專案自己
 * 的機率表/消費邏輯，所以這支測試依賴「本機剛好有開那個服務」這個可選
 * 的外部條件——跟其他測試腳本不同，偵測不到服務時直接略過（exit 0），
 * 不當成 CI 失敗，避免其他開發者或 CI 環境沒開那個服務時誤判成回歸。
 */
import { createTestRunner } from './_test-utils.mjs'

const { api, login, ok, section, summary } = createTestRunner()

async function main() {
  await login()

  section('偵測本機 Python 試算服務')
  const info = await api('/api/admin/game-simulator/scratch-info')
  if (info.status !== 200) {
    console.log(`  ⚠ 略過：偵測不到本機 Python 試算服務（status=${info.status}），這支測試依賴可選的本機服務，非本次改動的回歸範圍`)
    process.exit(0)
  }
  ok('scratch-info 回 200', true)

  const models = info.body?.models ?? {}
  const modelKeys = Object.keys(models)
  ok('回傳 9 個 model（01~09）', modelKeys.length === 9, JSON.stringify(modelKeys))
  ok('每個 model 都有 valid_coins 清單', modelKeys.every((k) => Array.isArray(models[k]?.valid_coins) && models[k].valid_coins.length > 0))

  section('拒絕不合法的 model')
  const invalidModel = await api('/api/admin/game-simulator/scratch?model=99&coin=0&count=1')
  ok('不合法 model（99）→ 400', invalidModel.status === 400, JSON.stringify(invalidModel.body))

  section('拒絕不合法的金額（model02）')
  const invalidCoin = await api('/api/admin/game-simulator/scratch?model=02&coin=99999999&count=1')
  ok('不合法金額 → 400', invalidCoin.status === 400, JSON.stringify(invalidCoin.body))

  section('試算張數上限/下限夾擠（model02，由 Python 服務本身夾擠）')
  const coin02 = models['02']?.valid_coins?.[0] ?? 0
  const zeroCount = await api(`/api/admin/game-simulator/scratch?model=02&coin=${coin02}&count=0`)
  ok('count=0 夾擠成至少 1 張', zeroCount.status === 200 && zeroCount.body?.results?.length === 1, JSON.stringify(zeroCount.body?.count))

  const overCount = await api(`/api/admin/game-simulator/scratch?model=02&coin=${coin02}&count=999`)
  ok('count=999 夾擠成上限 50 張', overCount.status === 200 && overCount.body?.results?.length === 50, JSON.stringify(overCount.body?.count))

  section('正常試算（model02，跑 5 張）')
  const run02 = await api(`/api/admin/game-simulator/scratch?model=02&coin=${coin02}&count=5`)
  ok('API 回 200', run02.status === 200, JSON.stringify(run02.body))
  const results02 = run02.body?.results ?? []
  ok('回傳 5 張卡', results02.length === 5)
  ok('每張卡都有 win_coin', results02.every((r) => typeof r.win_coin === 'number'))
  ok(`每張卡的 win_coin 都等於輸入的目標金額（${coin02}）`, results02.every((r) => r.win_coin === coin02))
  ok('每張卡都有卡片圖（b64card，data URL 格式）', results02.every((r) => typeof r.b64card === 'string' && r.b64card.startsWith('data:image/')))

  section('model07 已知無卡片素材（忠實反映原始服務行為，不是這次代理造成的落差）')
  if (models['07']) {
    const coin07 = models['07']?.valid_coins?.[0] ?? 0
    const run07 = await api(`/api/admin/game-simulator/scratch?model=07&coin=${coin07}&count=1`)
    ok('model07 API 回 200', run07.status === 200, JSON.stringify(run07.body))
    ok('model07 結果沒有 b64card（原始系統本來就沒有這個 model 的卡片素材）', !run07.body?.results?.[0]?.b64card)
  }

  section('model05 已知沒有 win_coin 欄位（曾導致前端 .toLocaleString() 整頁噴錯，現已改用 ?? 目標金額退回）')
  if (models['05']) {
    const nonZero05 = (models['05']?.valid_coins ?? []).filter((c) => c > 0)
    const coin05 = nonZero05[0] ?? models['05']?.valid_coins?.[0] ?? 0
    const run05 = await api(`/api/admin/game-simulator/scratch?model=05&coin=${coin05}&count=1`)
    ok('model05 API 回 200', run05.status === 200, JSON.stringify(run05.body))
    ok('model05 結果確實沒有 win_coin（確認這個退回情境持續存在，不是曾經才發生的暫時現象）',
      run05.body?.results?.[0]?.win_coin === undefined)
  }

  summary()
}

main().catch((err) => {
  console.error('測試腳本執行失敗：', err)
  process.exitCode = 1
})
