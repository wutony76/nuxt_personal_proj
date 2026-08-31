import RETRO_GAME_BASE from './base'

export default class RetroSpaceInvadersClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'spaceInvaders',
      name: '太空侵略者',
      coinRate: 0.3,
      coinCapPerRun: 300,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.SPACEINVADERS')
  }

  // 分數 = 依敵機所在列給分（越上排分越高）+ UFO 隨機獎勵分累加，開放式無上限，
  // 這裡只做防偽造的寬裕上限，需高於 coinCapPerRun/coinRate（300/0.3=1000），見 design.md Decision 9
  override maxReasonableScore(): number {
    return 8000
  }
}
