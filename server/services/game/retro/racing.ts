import RETRO_GAME_BASE from './base'

export default class RetroRacingClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'racing',
      name: '賽車',
      coinRate: 0.5,
      coinCapPerRun: 300,
      coinDailyCap: 100000
    })
    this.init()
  }
  init() {
    console.log('TTT---RUN.RACING')
  }

  // 賽車以存活 tick 數計分，理論上無上限（跑越久分越高），這裡只做防偽造的寬裕上限，
  // 不是遊戲設計上的真實天花板
  override maxReasonableScore(): number {
    return 5000
  }
}
