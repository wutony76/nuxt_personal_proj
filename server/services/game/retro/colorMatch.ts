import RETRO_GAME_BASE from './base'

export default class RetroColorMatchClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'colorMatch',
      name: 'COLOR MATCH',
      // 開放區間計分（答對 100~190 分 × 連續答對次數，無精確數學上限，見 colorMatchEngine.ts
      // 的 scoreForCombo／MAX_COMBO_FOR_SCORE），一場優秀表現約落在 3000~4000 分，
      // 取「3300~4000 分 ≈ 100~120 coin」對齊「一場優秀表現 ≈ 100 coin」的既有目標 → coinRate 0.03。
      coinRate: 0.03,
      coinCapPerRun: 120,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.COLORMATCH')
  }

  // 理論極限值估算（生理極限約 4 次/秒的作答速度、30 秒、單題封頂 190 分：
  // 30 * 4 * 190 = 22800，取整數留一點餘裕），超過視為異常回報，寫入紀錄與換算 coin 前先夾住。
  override maxReasonableScore(): number {
    return 24000
  }
}
