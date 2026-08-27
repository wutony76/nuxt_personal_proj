import RETRO_GAME_BASE from './base'

export default class RetroMatch3RushClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'match3rush',
      name: 'MATCH3 RUSH',
      coinRate: 0.1,
      coinCapPerRun: 300,
      coinDailyCap: 100000
    })
  }

  // 60 秒限時制，見 app/pages/game/match3-rush.vue；理論分數上限難以精算，
  // 這裡抓寬裕上限做異常防護，不追求精確
  override maxReasonableScore(): number {
    return 20000
  }
}
