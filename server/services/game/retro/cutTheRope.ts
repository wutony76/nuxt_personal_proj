import RETRO_GAME_BASE from './base'

export default class RetroCutTheRopeClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'cutTheRope',
      name: 'CUT THE ROPE',
      // 關卡改為無限（見 cutTheRopeEngine.ts 的 generateProceduralLevel），失敗只會重來同一關、
      // 不會結束遊戲，只能按 END 主動結算，分數不再有精確數學上限。改用「開放區間」估算：
      // 一場優秀表現約可清 10 關手工關 + 15 關左右的隨機關（每關約 200 基礎分 + 1~2 顆星 x100），
      // 抓「約 11000 分 ≈ 100 coin」對齊「一場優秀表現 ≈ 100 coin」的既有目標 → coinRate 0.01。
      coinRate: 0.01,
      coinCapPerRun: 100,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.CUTTHEROPE')
  }

  // 關卡無限、沒有失敗次數上限，理論上分數無界；抓一個遠高於正常優秀表現的寬鬆上限
  // （比照 bubbleShooter.ts 開放區間計分的做法），超過視為異常回報，寫入紀錄與換算 coin 前先夾住。
  override maxReasonableScore(): number {
    return 50000
  }
}
