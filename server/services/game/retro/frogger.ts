import RETRO_GAME_BASE from './base'

export default class RetroFroggerClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'frogger',
      name: 'FROGGER',
      // 分數 = HOP(10/步) + GOAL(200/蓮花座) + LEVEL CLEAR(500/輪) 的累加，開放式計分（見 design.md Decision 6）。
      // 一場優秀表現（清完 2~3 輪）約落在 2000 分上下 → 2000 × 0.05 = 100 coin，
      // 對齊「一場優秀表現 ≈ 100 coin」的既有目標。上線後應依實測分數分佈校準（見 design.md Open Questions）。
      coinRate: 0.05,
      // 略高於一場優秀表現的 coin，抓一點餘裕容許更長場次，同時避免無限刷分
      coinCapPerRun: 140,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.FROGGER')
  }

  // 清完 4~5 輪的高手場次估計也不會超過 5000（見 tasks.md 1.1），超過視為異常分數，
  // 寫入紀錄與換算 coin 前先夾住。
  override maxReasonableScore(): number {
    return 5000
  }
}
