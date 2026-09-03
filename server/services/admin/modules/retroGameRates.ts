import { Storage } from 'serv/services/storage'

export type RetroGameRates = {
  key: string
  name: string
  coinRate: number
  coinCapPerRun: number
  coinDailyCap: number
}

type RetroGameLike = RetroGameRates

/**
 * 後台：復古遊戲 coin 兌換三常數管理（見 design.md Decision 5）。
 * `RETRO_GAME_BASE` 的三個欄位本來就是一般可變欄位（非 readonly），這裡只是補上
 * 有輸入驗證的寫入邏輯，不需要改動 base.ts 本身的資料結構。
 */
export const adminRetroGameRatesService = {
  /**
   * @param key 遊戲 key
   * @param input.coinRate 兌換比
   * @param input.coinCapPerRun 單局上限
   * @param input.coinDailyCap 每日上限
   * @returns 更新後的三常數
   */
  setRates: (key: string, input: { coinRate: number; coinCapPerRun: number; coinDailyCap: number }): RetroGameRates => {
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
  }
}
