import { Storage } from 'serv/services/storage'
import { isDbEnabled, getDb } from 'serv/services/db'
import { retroGameRates as retroGameRatesTable } from 'serv/services/db/schema'

export type RetroGameRates = {
  key: string
  name: string
  coinRate: number
  coinCapPerRun: number
  coinDailyCap: number
}

type RetroGameLike = RetroGameRates

/**
 * 後台：復古遊戲 coin 兌換三常數管理（見 design.md Decision 5；DB 持久化見
 * migrate-game-settings-postgres/design.md 第 3a 節）。
 * `RETRO_GAME_BASE` 的三個欄位本來就是一般可變欄位（非 readonly），這裡只是補上
 * 有輸入驗證的寫入邏輯，不需要改動 base.ts 本身的資料結構。
 */
export const adminRetroGameRatesService = {
  /**
   * write-through：DB 啟用時先 upsert 成功才套用到執行期實例，見 design.md 第 2 節。
   * @param key 遊戲 key
   * @param input.coinRate 兌換比
   * @param input.coinCapPerRun 單局上限
   * @param input.coinDailyCap 每日上限
   * @returns 更新後的三常數
   */
  setRates: async (key: string, input: { coinRate: number; coinCapPerRun: number; coinDailyCap: number }): Promise<RetroGameRates> => {
    const instances = Storage.retroGames.instances as Record<string, RetroGameLike | undefined>
    const game = key ? instances[key] : undefined
    if (!game) {
      throw createError({ statusCode: 404, message: `找不到遊戲：${key}` })
    }

    const { coinRate, coinCapPerRun, coinDailyCap } = input
    if (![coinRate, coinCapPerRun, coinDailyCap].every((n) => Number.isFinite(n))) {
      throw createError({ statusCode: 400, message: '三個欄位都必須是數字。' })
    }
    if ([coinRate, coinCapPerRun, coinDailyCap].some((n) => n <= 0)) {
      throw createError({ statusCode: 400, message: '數值必須為正數，coinCapPerRun 不得為 0。' })
    }
    if (coinCapPerRun > coinDailyCap) {
      throw createError({ statusCode: 400, message: '單局上限不得高於每日上限。' })
    }

    if (isDbEnabled()) {
      await getDb().insert(retroGameRatesTable)
        .values({ gameKey: key, coinRate, coinCapPerRun, coinDailyCap })
        .onConflictDoUpdate({
          target: retroGameRatesTable.gameKey,
          set: { coinRate, coinCapPerRun, coinDailyCap, updatedAt: new Date() }
        })
    }

    game.coinRate = coinRate
    game.coinCapPerRun = coinCapPerRun
    game.coinDailyCap = coinDailyCap

    return {
      key: game.key,
      name: game.name,
      coinRate: game.coinRate,
      coinCapPerRun: game.coinCapPerRun,
      coinDailyCap: game.coinDailyCap
    }
  },

  /**
   * 開機回填：override-only，沒有種子分支（見 design.md 第 3a 節）。找不到對應執行期實例的
   * 殘留列（例如遊戲已下架）直接跳過，不噴錯。
   */
  rehydrateFromDb: async (): Promise<void> => {
    if (!isDbEnabled()) return
    const rows = await getDb().select().from(retroGameRatesTable)
    const instances = Storage.retroGames.instances as Record<string, RetroGameLike | undefined>
    for (const row of rows) {
      const game = instances[row.gameKey]
      if (!game) continue
      game.coinRate = Number(row.coinRate)
      game.coinCapPerRun = row.coinCapPerRun
      game.coinDailyCap = row.coinDailyCap
    }
  }
}
