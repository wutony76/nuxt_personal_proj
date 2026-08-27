import RETRO_GAME_BASE from './base'

export default class RetroTetriminosClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'tetriminos',
      name: '俄羅斯方塊',
      coinRate: 0.05,
      coinCapPerRun: 300,
      coinDailyCap: 100000
    })
    this.init()
  }
  init() {
    console.log('TTT---RUN.TETRIMINOS')
  }

  // 消行分數以 cleared*100+(cleared-1)*50 累加，理論上無上限（可持續消行），這裡只做防偽造的
  // 寬裕上限，不是遊戲設計上的真實天花板
  override maxReasonableScore(): number {
    return 100000
  }
}
