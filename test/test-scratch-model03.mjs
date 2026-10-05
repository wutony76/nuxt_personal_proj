/**
 * 刮刮樂 model03（剪刀石頭布）試算工具測試，見 add-scratch-model03-simulator。
 * 純模擬運算端點，不涉及下注/派彩/帳務，測試重點是「機率表消費邏輯」本身的
 * 一致性（忠實移植自外部 Python 專案，見 server/services/game/scratch/model03.ts
 * 檔頭註解的兩個刻意保留的非直覺行為）。
 */
import { createTestRunner } from './_test-utils.mjs'

const { api, login, ok, section, summary } = createTestRunner()

async function main() {
  await login()

  section('拒絕不合法的目標金額')
  const invalid = await api('/api/admin/game-simulator/scratch-model03', {
    method: 'POST',
    body: JSON.stringify({ cardWinCoin: 999, count: 1 })
  })
  ok('不合法目標金額（999）→ 400', invalid.status === 400, JSON.stringify(invalid.body))

  section('試算張數上限/下限夾擠')
  const zeroCount = await api('/api/admin/game-simulator/scratch-model03', {
    method: 'POST',
    body: JSON.stringify({ cardWinCoin: 1500, count: 0 })
  })
  ok('count=0 夾擠成至少 1 張', zeroCount.status === 200 && zeroCount.body?.cards?.length === 1, JSON.stringify(zeroCount.body?.cards?.length))

  const overCount = await api('/api/admin/game-simulator/scratch-model03', {
    method: 'POST',
    body: JSON.stringify({ cardWinCoin: 1500, count: 999 })
  })
  ok('count=999 夾擠成上限 50 張', overCount.status === 200 && overCount.body?.cards?.length === 50, JSON.stringify(overCount.body?.cards?.length))

  section('機率表消費邏輯一致性（目標金額 1500，跑 30 張覆蓋足夠樣本）')
  const res = await api('/api/admin/game-simulator/scratch-model03', {
    method: 'POST',
    body: JSON.stringify({ cardWinCoin: 1500, count: 30 })
  })
  ok('API 回 200', res.status === 200, JSON.stringify(res.body))
  const cards = res.body?.cards ?? []
  ok('回傳 30 張卡', cards.length === 30)
  ok('每張卡都有 5 局', cards.every((c) => c.rounds.length === 5))
  ok('每張卡的 winCoin 都等於輸入的目標金額（1500，原始系統就是直接回傳輸入值，不是加總）',
    cards.every((c) => c.winCoin === 1500))

  let sawNonZeroGetCoin = false
  let allConsistent = true
  for (const card of cards) {
    for (const round of card.rounds) {
      const isTieHands = round.play[0] === round.play[1]
      const expectedGetCoin = isTieHands ? round.coin / 2 : 0
      if (round.getCoin !== expectedGetCoin) allConsistent = false
      if (round.getCoin > 0) sawNonZeroGetCoin = true
    }
  }
  ok('getCoin 只在雙方手勢相同（平手）時才為非零值，且剛好等於 coin 的一半（忠實移植的既有行為，見 model03.ts 檔頭註解）',
    allConsistent)
  ok('30 張卡 × 5 局＝150 局樣本內，至少出現過一次非零 getCoin（確認平手分支真的有被抽到，不是邏輯死碼）',
    sawNonZeroGetCoin)

  section('目標金額 0（最低檔，全部面額皆為 0，驗證邊界情況）')
  const zeroTarget = await api('/api/admin/game-simulator/scratch-model03', {
    method: 'POST',
    body: JSON.stringify({ cardWinCoin: 0, count: 5 })
  })
  ok('目標金額 0 仍正常回應', zeroTarget.status === 200)
  ok('目標金額 0 時每局面額皆為顯示用隨機值、getCoin 皆為 0（5 局面額皆是 0，输的局不可能平手)',
    (zeroTarget.body?.cards ?? []).every((c) => c.rounds.every((r) => r.getCoin === 0)))

  summary()
}

main().catch((err) => {
  console.error('測試腳本執行失敗：', err)
  process.exitCode = 1
})
