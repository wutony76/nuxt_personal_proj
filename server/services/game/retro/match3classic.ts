import RETRO_GAME_BASE from './base'

export default class RetroMatch3ClassicClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'match3classic',
      name: 'MATCH3 CLASSIC',
      coinRate: 0.1,
      coinCapPerRun: 300,
      coinDailyCap: 100000
    })
    this.init()
  }
  init() {
    console.log('TTT---RUN.MATCH3CLASSIC')
  }
  // 20 步限步數制，見 app/pages/game/match3-classic.vue；步數受限使理論分數上限低於 RUSH，
  // 這裡抓寬裕上限做異常防護，不追求精確
  override maxReasonableScore(): number {
    return 8000
  }
}
