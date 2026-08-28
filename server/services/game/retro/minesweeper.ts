import RETRO_GAME_BASE from './base'

export default class RetroMinesweeperClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'minesweeper',
      name: '踩地雷',
      // MINESWEEPER 是本次唯一「有明確理論上限」的計分模型（5 關基礎分固定加總 = 1170，見 design.md Decision 4/6），
      // 不像其他遊戲開放式無上限。coinRate 0.2：中等發揮總分約 550 → 約 110 coin，對齊既有「一場優秀表現 ≈ 100 coin」目標
      coinRate: 0.2,
      coinCapPerRun: 300,
      coinDailyCap: 100000
    })
    this.init()
  }
  init() {
    console.log('TTT---RUN.MINESWEEPER')
  }

  // 5 關基礎分加總的精確理論上限 = 100+150+220+300+400 = 1170（見 design.md Decision 6）；
  // 分數有精確數學上限（不像其他遊戲開放式成長只能抓寬裕估計值），這裡只抓一點餘裕到 1200 即可
  override maxReasonableScore(): number {
    return 1200
  }
}
