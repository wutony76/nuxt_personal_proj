import RETRO_GAME_BASE from './base'

export default class RetroBreakoutClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'breakout',
      name: '打磚塊',
      coinRate: 0.3,
      coinCapPerRun: 300,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.BREAKOUT')
  }

  // 分數 = 依磚塊所在列給分累加，開放式無上限，
  // 這裡只做防偽造的寬裕上限，比照 SPACE INVADERS／TYPING 的估算方式，見 design.md Decision 4
  override maxReasonableScore(): number {
    return 8000
  }
}
