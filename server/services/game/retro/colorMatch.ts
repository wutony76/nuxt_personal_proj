import RETRO_GAME_BASE from './base'

export default class RetroColorMatchClass extends RETRO_GAME_BASE {
  constructor() {
    super({
      key: 'colorMatch',
      name: 'COLOR MATCH',
      // 生存模式計分（每次配對得 100 分 × 序列長度，milestone 時 double；時間只靠配對成功累加，
      // 沒有固定回合長度，見 colorMatchEngine.ts 的 SCORE_PER_SEQUENCE_STEP／MILESTONE_COMBO_STEP），
      // 無法像固定倒數題目算出精確數學上限，取「一場優秀表現 ≈ 100~150 coin」的既有目標 → coinRate 0.02。
      coinRate: 0.02,
      coinCapPerRun: 150,
      coinDailyCap: 100000
    })
    this.init()
  }

  init() {
    console.log('TTT---RUN.COLORMATCH')
  }

  // 生存模式時間會因連續配對成功持續累加，理論上沒有上限（技巧夠好可以一直玩下去），
  // 這裡取一個明顯超出正常玩家表現、只用來攔異常/機器人洗分的寬鬆上限；實際發放的
  // coin 已經被上面的 coinCapPerRun 卡住，分數本身超過這個值不影響 coin 上限，只是標記異常。
  override maxReasonableScore(): number {
    return 300000
  }
}
