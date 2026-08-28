import RETRO_GAME_BASE from './base'

export default class RetroPongClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'pong',
      name: '乒乓球',
      coinRate: 10,
      coinCapPerRun: 100,
      coinDailyCap: 100000
    })
    this.init()
  }
  init() {
    console.log('TTT---RUN.PONG')
  }

  // score = 玩家整場獲勝局數，賽制固定選 3/5/10 局其中之一並打滿全部局數，
  // 因此上限是精確值（選最大的 10 局且全勝），不是像其他遊戲那樣的寬裕估計值。
  override maxReasonableScore(): number {
    return 10
  }
}
