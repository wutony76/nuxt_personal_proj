import RETRO_GAME_BASE from './base'

export default class RetroPacManClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'pacman',
      name: 'PAC-MAN',
      // 開放式計分（吃豆10/大力丸50/吃鬼200~1600連鎖/水果100~500，跨關卡累加無上限），
      // 單關粗估可達數千分，coinRate 先抓低值，未實測校準
      coinRate: 0.05,
      // 使用者明確要求調高單局上限至 2500（比照 spaceShooter 同一種「分數可以衝很高、
      // 想激勵玩家持續破關」的設計取向），需搭配 maxReasonableScore 一併調高才有餘裕
      // （否則 2500/coinRate=50000 剛好卡在舊上限，等於要打到防偽造天花板才拿得到）
      coinCapPerRun: 2500,
      coinDailyCap: 100000
    })
    this.init()
  }
  init() {
    console.log('TTT---RUN.PACMAN')
  }

  // 理論上無上限（可無限過關），這裡只做防偽造的寬裕上限；需明顯高於 coinCapPerRun/coinRate
  // (=2500/0.05=50000)，才能讓 2500 上限對持續破關的玩家有實質意義，抓 200000（20萬）
  override maxReasonableScore(): number {
    return 200000
  }
}
