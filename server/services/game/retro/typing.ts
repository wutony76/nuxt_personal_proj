import RETRO_GAME_BASE from './base'

export default class RetroTypingClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'typing',
      name: '打字遊戲',
      coinRate: 0.3,
      coinCapPerRun: 300,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.TYPING')
  }

  // 分數 = 完成單字（字長×10）× 連擊倍率累加，開放式無上限，
  // 這裡只做防偽造的寬裕上限，比照 SPACE INVADERS 的估算方式，見 design.md Decision 5
  override maxReasonableScore(): number {
    return 8000
  }
}
