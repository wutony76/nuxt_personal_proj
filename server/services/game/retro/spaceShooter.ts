import RETRO_GAME_BASE from './base'

export default class RetroSpaceShooterClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'spaceShooter',
      name: '太空射擊',
      // 使用者明確指定基本/強化/里程碑分數比例改為 1:3:5（比先前的 4:15:50 再大幅調降），
      // coinRate 同步反向調高（0.2→0.3），維持「同樣表現水準拿到的 coin 量級不變」
      coinRate: 0.3,
      // 使用者明確要求：分數本身可以衝很高沒關係，單局 coin 上限直接抓 2500（比其他遊戲的 300 高很多）
      coinCapPerRun: 2500,
      coinDailyCap: 100000
    })
    this.init()
  }
  init() {
    console.log('TTT---RUN.SPACESHOOTER')
  }

  // 分數 = 擊落敵機加權得分 × 連擊倍率，理論上無上限（打越久、連擊維持越好分越高），
  // 這裡只做防偽造的寬裕上限（比照 match3 系列的計分模型獨立估算），不是遊戲設計上的真實天花板；
  // 上限需高於 coinCapPerRun/coinRate（2500/0.3≈8334）才不會反過來卡住 2500 coin 上限，故抓 10000
  override maxReasonableScore(): number {
    return 10000
  }
}
