import RETRO_GAME_BASE from './base'

export default class RetroSolitaireClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'solitaire',
      name: '接龍',
      coinRate: 0.3,
      coinCapPerRun: 300,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.SOLITAIRE')
  }

  // 分數 = 合法移動(+5)/翻新牌(+10)/移至 Foundation(+10) 累加 + 完成獎勵(+200)，
  // 受牌局規模限制、非完全開放式，這裡只做防偽造的寬裕上限，見 design.md Decision 5
  override maxReasonableScore(): number {
    return 3000
  }
}
