import RETRO_GAME_BASE from './base'

export default class RetroMazeClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'maze',
      name: 'MAZE',
      // 分數跨關累計、無精確數學上限（見 mazeEngine.ts 的 scoreForLevelClear），一場優秀表現
      // 約落在 2500~3000 分（連續過關 10~12 關），取「2760 分 ≈ 100 coin」對齊
      // 「一場優秀表現 ≈ 100 coin」的既有目標 → coinRate 0.035。
      coinRate: 0.035,
      coinCapPerRun: 130,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.MAZE')
  }

  // 理論極限值估算：CLASSIC 模式最多連續闖到第 50 關（MAX_CLASSIC_LEVEL）自動結算，關卡加成在
  // 第 30 關封頂（MAZE_LEVEL_BONUS_CAP_LEVEL），每關都以零效率懲罰（步數/時間皆為最優）計算：
  // 第 1~30 關 sum(100+20*level) = 12300，第 31~50 關每關固定 700 分 = 14000，合計 26300，
  // 取整數留一點餘裕，超過視為異常回報，寫入紀錄與換算 coin 前先夾住。
  override maxReasonableScore(): number {
    return 28000
  }
}
