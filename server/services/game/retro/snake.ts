import RETRO_GAME_BASE from './base'

export default class RetroSnakeClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'snake',
      name: '貪吃蛇',
      coinRate: 5,
      coinCapPerRun: 300,
      coinDailyCap: 100000
    })
    this.init()
  }
  init() {
    console.log('TTT---RUN.SNAKE')
  }

  // 棋盤上限約 30x30 格（見 app/pages/game/snake.vue 的 BOARD_SIZE），分數 = 蛇身長度 - 1，
  // 理論最大值遠低於 900，這裡抓寬裕上限做異常防護，不追求精確
  override maxReasonableScore(): number {
    return 900
  }
}
