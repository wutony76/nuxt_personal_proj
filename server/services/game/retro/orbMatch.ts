import RETRO_GAME_BASE from './base'

export default class RetroOrbMatchClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'orbMatch',
      name: 'ORB MATCH',
      coinRate: 0.25,
      coinCapPerRun: 300,
      coinDailyCap: 100000
    })
    this.init()
  }
  init() {
    console.log('TTT---RUN.ORBMATCH')
  }

  // 90 秒限時制、6x6 種屬性珠固定難度，計分公式與 MATCH3 RUSH 相同（消除格數 x4 x連鎖倍率），
  // 這裡抓寬裕上限做異常防護，不追求精確，比照 match3rush.ts 的估算方式。
  override maxReasonableScore(): number {
    return 6000
  }
}
