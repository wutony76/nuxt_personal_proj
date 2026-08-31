import RETRO_GAME_BASE from './base'

export default class RetroPacManClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'pacman',
      name: 'PAC-MAN',
      // 開放式計分（吃豆10/大力丸50/吃鬼200~1600連鎖/水果100~500，跨關卡累加無上限），
      // 單關粗估可達數千分，coinRate 先抓低值，未實測校準
      coinRate: 0.05,
      coinCapPerRun: 300,
      coinDailyCap: 100000
    })
    this.init()
  }
  init() {
    console.log('TTT---RUN.PACMAN')
  }

  // 理論上無上限（可無限過關），這裡只做防偽造的寬裕上限，需高於 coinCapPerRun/coinRate(=6000)
  override maxReasonableScore(): number {
    return 50000
  }
}
