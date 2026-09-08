import RETRO_GAME_BASE from './base'

export default class RetroBubbleShooterClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'bubbleShooter',
      name: 'BUBBLE SHOOTER',
      // 開放區間計分（消除+掉落連鎖無精確數學上限，見 bubbleShooterEngine.ts），一場優秀表現
      // 約落在 3000~4000 分，取「3300 分 ≈ 100 coin」對齊「一場優秀表現 ≈ 100 coin」的既有目標
      // → coinRate 0.03。
      coinRate: 0.03,
      coinCapPerRun: 120,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.BUBBLESHOOTER')
  }

  // 理論極限值估算：單次發射最極端情況下可能一次清空整個 12x8=96 格盤面（消除+懸空全掉落），
  // 抓一個寬鬆但非無限的上限，加上長時間遊玩的連鎖累積空間，超過視為異常回報，
  // 寫入紀錄與換算 coin 前先夾住。
  override maxReasonableScore(): number {
    return 50000
  }
}
