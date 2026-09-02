import RETRO_GAME_BASE from './base'

export default class RetroWhackAMoleClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'whackAMole',
      name: 'WHACK-A-MOLE',
      // 開放區間計分（擊中地鼠 × combo 倍率累加，越玩越快、無精確數學上限），見 design.md Decision 6：
      // 一場優秀表現約落在數百到一千多分，取「1000~1250 分 ≈ 80~100 coin」對齊
      // 「一場優秀表現 ≈ 100 coin」的既有目標 → coinRate 0.08。
      coinRate: 0.08,
      // 略高於預期優秀表現的 coin 數，留防呆餘裕
      coinCapPerRun: 150,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.WHACK-A-MOLE')
  }

  // 理論極限值估算（Spawn 間隔下限 400ms、玩家零延遲即擊、combo 全程 4 倍，60 秒約 150 次 × 10 × 4 = 6000，
  // 見 design.md Decision 6），超過視為異常回報，寫入紀錄與換算 coin 前先夾住，防止竄改分數。
  override maxReasonableScore(): number {
    return 6000
  }
}
