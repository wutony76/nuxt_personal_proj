import RETRO_GAME_BASE from './base'

export default class RetroFlappyClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'flappy',
      name: 'FLAPPY',
      // 分數 = 本局通過的管道組數，無理論上限（開放式計分，見 design.md Decision 4）。
      // 典型優秀表現落在數十到一兩百之間，取一場優秀表現 ≈ 150 分校準：
      // 150 × 0.7 ≈ 105 coin，對齊「一場優秀表現 ≈ 100 coin」的既有目標。
      coinRate: 0.7,
      // 略高於 105，抓一點餘裕防呆（比照其他開放式計分遊戲的抓法）
      coinCapPerRun: 160,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.FLAPPY')
  }

  // 通過管道數遠高於典型一兩百分的極端高手表現估計也不會超過 500（見 design.md Decision 4），
  // 超過視為異常分數，寫入紀錄與換算 coin 前先夾住。
  override maxReasonableScore(): number {
    return 500
  }
}
