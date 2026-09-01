import RETRO_GAME_BASE from './base'

export default class Retro2048Class extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: '2048',
      name: '2048',
      // 分數 = 本局所有合併事件的「合併後數值」加總，無理論上限（見 design.md Decision 6/7），
      // 且量級明顯低於多數遊戲：典型優秀表現（合成 2048）約 20000 分。抓「20000 分 ≈ 100 coin」
      // 對齊既有目標 → coinRate 0.005（20000 × 0.005 = 100 coin）。
      coinRate: 0.005,
      // 約 1.5 倍於典型優秀表現，容許合成 4096/8192 等更高分場次，同時避免無限刷分
      coinCapPerRun: 150,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.2048')
  }

  // 合成 8192 Tile 這種極罕見的高手場次估計也不會超過 300000（見 design.md Decision 6），
  // 超過視為異常分數，寫入紀錄與換算 coin 前先夾住。
  override maxReasonableScore(): number {
    return 300000
  }
}
