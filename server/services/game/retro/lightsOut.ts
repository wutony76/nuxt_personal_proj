import RETRO_GAME_BASE from './base'

export default class RetroLightsOutClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'lightsOut',
      name: 'LIGHTS OUT',
      // 開放式無上限計分（關卡可無限往上疊加，見 design.md Decision 5）：單關分數
      // = ClearBonus + 步數反比 EfficiencyScore，一場水準之上約推進 10~12 關、累計 1500~2500 分。
      // 抓「約 1000 分 ≈ 100 coin」對齊「一場優秀表現 ≈ 100 coin」的既有目標 → coinRate 0.1。
      coinRate: 0.1,
      // 略高於預期優秀表現的 coin 數（累計 2500 分 × 0.1 = 250 已被本上限夾住），留防呆餘裕
      coinCapPerRun: 120,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.LIGHTS-OUT')
  }

  // 寬裕上限估算（見 design.md Decision 5）：一場優秀表現累計約 1500~2500 分，抓 3000 作為寬裕上限，
  // 超過視為異常回報，寫入紀錄與換算 coin 前先夾住，防止竄改分數。
  override maxReasonableScore(): number {
    return 3000
  }
}
