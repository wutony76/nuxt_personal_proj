import RETRO_GAME_BASE from './base'

export default class RetroRunnerClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'runner',
      name: '跑酷',
      // 分數公式調降為原本的 1/3（app/pages/game/runner.vue 的 distance 除數 10→30），
      // coinRate 刻意維持不變——同樣存活時間賺到的 coin 會跟著變少，是拍板的結果，不是遺漏
      coinRate: 0.5,
      coinCapPerRun: 300,
      coinDailyCap: 100000
    })
    this.init()
  }
  init() {
    console.log('TTT---RUN.RUNNER')
  }

  // 跑酷以存活距離計分，理論上無上限（跑越久分越高），這裡只做防偽造的寬裕上限
  // （比照 racing.ts 同屬開放式計分的既有校準），不是遊戲設計上的真實天花板；
  // 隨分數公式調降等比例調降（5000 → 1700）
  override maxReasonableScore(): number {
    return 1700
  }
}
