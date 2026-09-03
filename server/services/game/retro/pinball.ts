import RETRO_GAME_BASE from './base'

export default class RetroPinballClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'pinball',
      name: 'PINBALL',
      // 開放式無上限計分（基礎分 × Combo 倍率 × Fever 加成，見 design.md Decision 7）：
      // 設計階段估算值，上線後應依實測分數分佈校準。
      coinRate: 0.01,
      coinCapPerRun: 150,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.PINBALL')
  }

  // 開放式計分的寬鬆防呆上限（見 design.md Decision 7）：無精確理論天花板，
  // 抓 30000 作為寬裕上限，超過視為異常回報，寫入紀錄與換算 coin 前先夾住，防止竄改分數。
  override maxReasonableScore(): number {
    return 30000
  }
}
