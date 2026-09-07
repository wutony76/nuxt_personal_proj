import RETRO_GAME_BASE from './base'

export default class RetroBattleshipClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'battleship',
      name: '戰艦',
      // 分數 = HIT(+33)*17 + SUNK(+167)*5 + WIN(+333)，單局勝利恆為固定值 1729（見 design.md Decision 5／6）。
      // 頁面另有「連勝加碼」玩法（battleshipEngine.ts 的 applyChainWin/applyChainLose，比照 connect4）：
      // 贏了選擇再戰，下一場贏 = 本局分數 x2 累加進連勝分數；輸了 = 連勝分數打 8 折並強制結算；
      // 最多連續贏 5 場（MAX_CHAIN_WINS）後自動結算。理論上限 = 單局上限 1729（第 1 場）
      // + 4 場 x 單局上限 1729 x 2 倍 = 15561（對齊 battleshipEngine.ts 的 MAX_CHAIN_SCORE）。
      coinRate: 0.06,
      // 等於理論上限換算 coin（15561 x 0.06 = 933.66，取整數 933），不需額外緩衝
      coinCapPerRun: 933,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.BATTLESHIP')
  }

  // 連勝加碼理論上限 = 1729（單局，見上方註解）+ 4 場 x 1729 x 2 倍 = 15561，
  // 超過視為異常分數，寫入紀錄與換算 coin 前先夾住。
  override maxReasonableScore(): number {
    return 15561
  }
}
