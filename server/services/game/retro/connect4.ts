import RETRO_GAME_BASE from './base'

export default class RetroConnect4Class extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'connect4',
      name: 'CONNECT 4',
      // 計分採 design.md Decision 5「固定基礎分 + 落子效率加成」模型（已拍板）：
      // WIN = 60 + max(0, 40 - (playerMoves-4)*3)，單局上限 100；DRAW = 20；LOSE = 0。
      // 頁面另有「連勝加碼」玩法（connect4Engine.ts 的 applyChainWin/applyChainLose）：
      // 贏了選擇再戰，下一場贏 = 本局分數 x2 累加進連勝分數；輸了 = 連勝分數打 8 折並強制結算；
      // 最多連續贏 5 場（MAX_CHAIN_WINS）後自動結算。理論上限 = 單局上限 100（第 1 場）
      // + 4 場 x 單局上限 100 x 2 倍 = 900（對齊 connect4Engine.ts 的 MAX_CHAIN_SCORE）。
      // coinRate 1（分數即 coin，對齊「一場優秀表現 ≈ 100 coin」的既有目標，連勝加碼可累積更高）。
      coinRate: 1,
      // 等於上限，不需額外緩衝（900 已是精確天花板）
      coinCapPerRun: 900,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.CONNECT4')
  }

  // 連勝加碼理論上限 = 100（單局，見 design.md Decision 5/6）+ 4 場 x 100 x 2 倍 = 900，
  // 超過視為異常分數，寫入紀錄與換算 coin 前先夾住。
  override maxReasonableScore(): number {
    return 900
  }
}
