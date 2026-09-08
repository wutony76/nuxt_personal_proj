import RETRO_GAME_BASE from './base'

export default class RetroCutTheRopeClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'cutTheRope',
      name: 'CUT THE ROPE',
      // 分數 = 10 關 x（過關基礎分 200 + 最多 3 顆星 x100），有精確數學上限（見 cutTheRopeEngine.ts
      // 的 CTR_MAX_SCORE：10 x (200+300) = 5000）。coinRate 0.02（滿分 5000 ≈ 100 coin，對齊
      // 「一場優秀表現 ≈ 100 coin」的既有目標）。
      coinRate: 0.02,
      // 等於精確上限換算 coin（5000 x 0.02 = 100），不需額外緩衝
      coinCapPerRun: 100,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.CUTTHEROPE')
  }

  // 精確理論上限：10 關 x（200 + 3x100）= 5000（見上方註解／cutTheRopeEngine.ts 的 CTR_MAX_SCORE），
  // 超過視為異常回報，寫入紀錄與換算 coin 前先夾住。
  override maxReasonableScore(): number {
    return 5000
  }
}
