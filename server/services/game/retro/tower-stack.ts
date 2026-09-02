import RETRO_GAME_BASE from './base'

export default class RetroTowerStackClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'towerStack',
      name: 'TOWER STACK',
      // 開放式無上限計分（塔高 × 基礎分 + Perfect／Combo 加成，見 design.md Decision 5）：
      // 一場優秀表現（塔高約 40 層、其中約 15 次 Perfect）≈ 700 分。
      // 抓「約 700 分 ≈ 100 coin」對齊「一場優秀表現 ≈ 100 coin」的既有目標 → coinRate 0.14。
      coinRate: 0.14,
      // 略高於預期優秀表現的 coin 數，留防呆餘裕（避免無限刷分）
      coinCapPerRun: 110,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.TOWER-STACK')
  }

  // 開放式計分的寬鬆防呆上限（見 design.md Decision 5）：無精確理論天花板，
  // 抓 20000 作為寬裕上限，超過視為異常回報，寫入紀錄與換算 coin 前先夾住，防止竄改分數。
  override maxReasonableScore(): number {
    return 20000
  }
}
