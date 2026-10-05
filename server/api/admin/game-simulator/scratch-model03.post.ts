import { sessionController } from '../../../services/auth'
import { analyzeModel03Card, listModel03WinCoins } from '../../../services/game/scratch/model03'

/**
 * 後台「遊戲試算」：刮刮樂 model03（剪刀石頭布）模擬試算，見
 * `openspec/changes/add-scratch-model03-simulator/proposal.md`。
 *
 * 純模擬運算，不扣款、不派彩、不寫入任何玩家帳務——跟 `bingo-test-draw`
 * 這類「模擬開獎＋真的結算」的工具不同，這支完全不碰 `Storage`。
 *
 * body: {
 *   cardWinCoin: number   // 目標金額，必須是 listModel03WinCoins() 回傳清單裡的其中一個
 *   count?: number        // 模擬張數，1~50（預設 10）
 * }
 */
type Body = {
  cardWinCoin?: number
  count?: number
}

export default defineEventHandler(async (event) => {
  sessionController.requireAdmin(event)
  const body = await readBody<Body>(event)

  const cardWinCoin = Number(body?.cardWinCoin)
  const validCoins = listModel03WinCoins()
  if (!validCoins.includes(cardWinCoin)) {
    throw createError({ statusCode: 400, message: `cardWinCoin 必須是 ${validCoins.join('、')} 其中之一` })
  }

  // ⚠️ 不能用 `Number(body?.count) || 10`：0 是合法但 falsy 的值，`|| 10` 會把它誤當成
  // 「沒填」蓋成預設值 10，讓 count=0 這個邊界情況測試不出來（已被 test-scratch-model03.mjs
  // 抓到）。改成先判斷是不是有限數字，不是才退回預設值。
  const rawCount = Number(body?.count)
  const count = Math.min(Math.max(Math.trunc(Number.isFinite(rawCount) ? rawCount : 10), 1), 50)

  const start = Date.now()
  const cards = Array.from({ length: count }, () => analyzeModel03Card(cardWinCoin)).filter((c) => c !== null)
  const elapsedMs = Date.now() - start

  return { cards, elapsedMs }
})
