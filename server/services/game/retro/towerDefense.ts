import RETRO_GAME_BASE from './base'

export default class RetroTowerDefenseClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'towerDefense',
      name: 'TOWER DEFENSE',
      // 無限波（Endless）計分：score = 擊殺獎勵 + 波次通過獎勵，理論上無上限。
      // 設計階段估算值（見 openspec/changes/add-tower-defense-game/design.md Decision 8），
      // 以「撐到 wave 20～25」為 ≈100 coin 的校準基準，上線後應依實測分數分佈調整。
      coinRate: 0.005,
      coinCapPerRun: 150,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.TOWER_DEFENSE')
  }

  // 無限波下沒有理論分數天花板，這裡只是防呆用的異常值防線（見 design.md Decision 8），
  // 抓 300000 以確保合法的超長局（撐到 wave 60+）不會被誤判為異常分數。
  override maxReasonableScore(): number {
    return 300000
  }
}
