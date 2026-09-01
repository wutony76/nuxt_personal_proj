import RETRO_GAME_BASE from './base'

export default class RetroBattleshipClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'battleship',
      name: '戰艦',
      coinRate: 0.06,
      coinCapPerRun: 130,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.BATTLESHIP')
  }

  // 分數 = HIT(+33)*17 + SUNK(+167)*5 + WIN(+333)，玩家獲勝時恆為固定值 1729（見 design.md Decision 5／6），
  // 落敗局分數為當下累積的 HIT/SUNK 加總，必然低於 1729，這裡直接對齊精確上限即可，不需要額外緩衝。
  override maxReasonableScore(): number {
    return 1729
  }
}
