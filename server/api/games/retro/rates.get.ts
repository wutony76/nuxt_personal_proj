import { Storage } from '../../../services/storage'

type RetroGameLike = {
  key: string
  name: string
  coinRate: number
  coinCapPerRun: number
  coinDailyCap: number
}

/**
 * 五款復古遊戲的 coin 兌換比是公開資訊（不含任何使用者資料），
 * 供各遊戲頁面的兌換比 dialog 顯示，訪客不登入也能看到——比照既有彩池 /jackpot、/pool 的公開模式，
 * 見 server/middleware/auth.ts 的 PUBLIC_GAME_SUFFIXES。
 * 這裡採單一清單路由（比照既有 /api/lottery/games），而非「每個遊戲一個資料夾」慣例，
 * 因為這是跨遊戲的靜態設定清單查詢，不是針對單一遊戲的使用者資料操作。
 */
export default defineEventHandler(() => {
  const instances = Storage.retroGames.instances as Record<string, RetroGameLike>
  const rates = Object.values(instances).map((game) => ({
    key: game.key,
    name: game.name,
    coinRate: game.coinRate,
    coinCapPerRun: game.coinCapPerRun,
    coinDailyCap: game.coinDailyCap
  }))
  return { rates }
})
