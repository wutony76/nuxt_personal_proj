import RETRO_GAME_BASE from './base'

export default class RetroConnect4Class extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'connect4',
      name: 'CONNECT 4',
      // 計分採 design.md Decision 5「固定基礎分 + 落子效率加成」模型（已拍板）：
      // WIN = 60 + max(0, 40 - (playerMoves-4)*3)，上限 100；DRAW = 20；LOSE = 0。
      // 公式有精確理論上限 100，比照 BATTLESHIP「有數學上限的計分可貼著上限設定」：
      // coinRate 1（100 分 ≈ 100 coin，對齊「一場優秀表現 ≈ 100 coin」的既有目標）。
      coinRate: 1,
      // 等於上限，不需額外緩衝（100 已是精確天花板）
      coinCapPerRun: 100,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.CONNECT4')
  }

  // 公式理論上限 = WIN_BASE(60) + MAX_EFFICIENCY_BONUS(40) = 100（見 design.md Decision 5/6），
  // 超過視為異常分數，寫入紀錄與換算 coin 前先夾住。
  override maxReasonableScore(): number {
    return 100
  }
}
