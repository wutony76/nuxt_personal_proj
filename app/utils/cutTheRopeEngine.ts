/**
 * CUT THE ROPE 遊戲核心邏輯（純 TypeScript，完全不依賴 Vue／DOM，比照 pinballEngine.ts 的簡化物理精神）。
 *
 * 明確不使用任何物理引擎（Matter.js／Box2D 等），只實作最小夠用的數值近似：
 *   - 重力：每 tick 對 vy 加一個固定常數。
 *   - 繩子＝距離約束（distance constraint，輕量版 Verlet）：糖果距離錨點超過繩長時，把糖果拉回
 *     以錨點為圓心、繩長為半徑的圓上，並移除速度中「沿繩子方向」的分量（只留切線分量）。
 *     這個技巧不需要手動推導鐘擺角度方程式，行為上自然就是「重力 + 速度 + 擺盪」。
 *   - 多條繩子同時附著時，對每條依序做一次上述修正，是近似解、不是精確解（見 spec「不追求真實
 *     物理精度」）。
 *   - 邊界／尖刺：簡單距離判斷 + 速度反射（比照 pinballEngine 的 restitution 常數手法）。
 *
 * 10 關關卡資料是手工設計的固定常數（CUT_THE_ROPE_LEVELS），不是程序生成。
 */

// ── 型別 ──
export type CutTheRopeStatus = 'idle' | 'playing' | 'paused' | 'gameover'
export type Vec2 = { x: number; y: number }
export type RopeState = { id: string; anchor: Vec2; length: number; attached: boolean }
export type StarState = { id: string; pos: Vec2; collected: boolean }
export type CandyState = { x: number; y: number; vx: number; vy: number }

export type CutTheRopeLevelDef = {
  candyStart: Vec2
  ropes: Array<{ anchor: Vec2; length: number }>
  stars: Vec2[]
  goal: Vec2
  spikes?: Vec2[]
}

export type CutTheRopeSnapshot = {
  status: CutTheRopeStatus
  levelIndex: number
  candy: CandyState
  ropes: RopeState[]
  stars: StarState[]
  goal: Vec2
  spikes: Vec2[]
  starsThisAttempt: number
  totalScore: number
  totalStars: number
  message: 'none' | 'star' | 'cleared' | 'failed' | 'allCleared'
}

export type CutTheRopeTickResult = {
  starCollected: boolean
  levelCleared: boolean
  failed: boolean
  allCleared: boolean
  levelScoreGained: number
}

// ── 對局常數 ──
export const CTR_STAGE_WIDTH = 360
export const CTR_STAGE_HEIGHT = 520
export const TOTAL_LEVELS = 10

export const CANDY_RADIUS = 14
export const STAR_RADIUS = 18
export const GOAL_RADIUS = 32
export const SPIKE_RADIUS = 16

export const CTR_GRAVITY = 0.32
export const WALL_RESTITUTION = 0.6
/** 剪繩子的可點擊熱區半徑（比視覺線條寬很多，避免玩家點不到細線） */
export const ROPE_HIT_RADIUS = 22

export const SCORE_PER_STAR = 100
export const LEVEL_CLEAR_BASE_SCORE = 200
/** 理論上限＝10 關 x（基礎分 200 + 3 顆星 x100）＝5000，對齊 server 端 maxReasonableScore() */
export const CTR_MAX_SCORE = TOTAL_LEVELS * (LEVEL_CLEAR_BASE_SCORE + 3 * SCORE_PER_STAR)

/**
 * 10 關手工關卡（見檔頭說明），難度曲線：
 *   1：一條繩，直接剪。2：加星星。3：需要擺盪借力。4：擺盪路徑收集兩顆星。
 *   5~6：兩條繩，剪的順序影響結果。7~10：加入尖刺，需要抓時機閃避。
 */
export const CUT_THE_ROPE_LEVELS: CutTheRopeLevelDef[] = [
  {
    candyStart: { x: 180, y: 180 },
    ropes: [{ anchor: { x: 180, y: 60 }, length: 120 }],
    stars: [{ x: 180, y: 300 }],
    goal: { x: 180, y: 460 }
  },
  {
    candyStart: { x: 180, y: 200 },
    ropes: [{ anchor: { x: 180, y: 60 }, length: 140 }],
    stars: [
      { x: 180, y: 330 },
      { x: 180, y: 400 }
    ],
    goal: { x: 180, y: 470 }
  },
  {
    candyStart: { x: 250, y: 110 },
    ropes: [{ anchor: { x: 120, y: 60 }, length: 160 }],
    stars: [{ x: 260, y: 260 }],
    goal: { x: 290, y: 420 }
  },
  {
    // 錨點正上方偏移起手（起始距離＝繩長，一開始就是拉直的），釋放後自然形成鐘擺弧線，
    // 星星／終點都放在弧線實際會經過的座標上（見開發時用 tracer 腳本描出的軌跡）。
    candyStart: { x: 20, y: 169 },
    ropes: [{ anchor: { x: 150, y: 60 }, length: 170 }],
    stars: [
      { x: 108, y: 225 },
      { x: 255, y: 194 }
    ],
    goal: { x: 271, y: 185 }
  },
  {
    candyStart: { x: 180, y: 150 },
    ropes: [
      { anchor: { x: 90, y: 60 }, length: 140 },
      { anchor: { x: 270, y: 60 }, length: 140 }
    ],
    stars: [{ x: 180, y: 290 }],
    goal: { x: 180, y: 460 }
  },
  {
    candyStart: { x: 150, y: 140 },
    ropes: [
      { anchor: { x: 80, y: 60 }, length: 130 },
      { anchor: { x: 260, y: 90 }, length: 190 }
    ],
    stars: [
      { x: 150, y: 280 },
      { x: 260, y: 340 }
    ],
    goal: { x: 290, y: 440 }
  },
  {
    // 尖刺卡在「一放手就直直往下掉」的路徑正中間；起手角度偏移讓玩家可以晚一點剪，
    // 讓糖果先擺盪到右側再往下掉，繞開尖刺落進偏右的終點（軌跡同樣用 tracer 腳本驗證過）。
    candyStart: { x: 100, y: 175 },
    ropes: [{ anchor: { x: 180, y: 60 }, length: 140 }],
    stars: [{ x: 180, y: 200 }],
    goal: { x: 285, y: 310 },
    spikes: [{ x: 100, y: 350 }]
  },
  {
    candyStart: { x: 260, y: 120 },
    ropes: [{ anchor: { x: 120, y: 60 }, length: 170 }],
    stars: [{ x: 270, y: 280 }],
    goal: { x: 300, y: 440 },
    spikes: [
      { x: 200, y: 440 },
      { x: 100, y: 300 }
    ]
  },
  {
    candyStart: { x: 180, y: 150 },
    ropes: [
      { anchor: { x: 90, y: 60 }, length: 140 },
      { anchor: { x: 270, y: 60 }, length: 140 }
    ],
    stars: [
      { x: 180, y: 290 },
      { x: 90, y: 200 }
    ],
    goal: { x: 180, y: 460 },
    spikes: [{ x: 280, y: 460 }]
  },
  {
    candyStart: { x: 150, y: 130 },
    ropes: [
      { anchor: { x: 70, y: 60 }, length: 120 },
      { anchor: { x: 250, y: 80 }, length: 180 }
    ],
    stars: [
      { x: 150, y: 260 },
      { x: 250, y: 320 },
      { x: 150, y: 400 }
    ],
    goal: { x: 300, y: 460 },
    spikes: [{ x: 60, y: 460 }]
  }
]

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)

/** 建構時的固定初始關卡（不吃亂數，關卡本身就是固定資料，天生沒有 hydration mismatch 疑慮） */
export type CutTheRopeEngineOptions = Record<string, never>

/**
 * CUT THE ROPE 引擎：整合關卡載入／重力／繩子約束／剪繩／收集星星／終點／尖刺判定／計分。
 * 對外提供 `reset/start/pause/resume`、`cutRope`、`tick`、`getSnapshot`。
 */
export default class CutTheRopeEngine {
  private status: CutTheRopeStatus = 'idle'
  private levelIndex = 1
  private candy: CandyState = { x: 0, y: 0, vx: 0, vy: 0 }
  private ropes: RopeState[] = []
  private stars: StarState[] = []
  private goal: Vec2 = { x: 0, y: 0 }
  private spikes: Vec2[] = []
  private starsThisAttempt = 0
  private totalScore = 0
  private totalStars = 0
  private message: CutTheRopeSnapshot['message'] = 'none'

  /** 依 CUT_THE_ROPE_LEVELS[levelIndex-1] 重建當前關卡的糖果／繩子／星星／終點／尖刺 */
  private loadLevel(): void {
    const def = CUT_THE_ROPE_LEVELS[this.levelIndex - 1]!
    this.candy = { x: def.candyStart.x, y: def.candyStart.y, vx: 0, vy: 0 }
    this.ropes = def.ropes.map((r, i) => ({ id: `rope-${i}`, anchor: { ...r.anchor }, length: r.length, attached: true }))
    this.stars = def.stars.map((s, i) => ({ id: `star-${i}`, pos: { ...s }, collected: false }))
    this.goal = { ...def.goal }
    this.spikes = (def.spikes ?? []).map((s) => ({ ...s }))
    this.starsThisAttempt = 0
  }

  /** 完整重置；status 回到 idle，不殘留上一局資料 */
  reset(): void {
    this.status = 'idle'
    this.levelIndex = 1
    this.totalScore = 0
    this.totalStars = 0
    this.message = 'none'
    this.loadLevel()
  }

  /** 開始新的一局：完整重置後進入 playing */
  start(): void {
    this.reset()
    this.status = 'playing'
  }

  pause(): void {
    if (this.status !== 'playing') return
    this.status = 'paused'
  }

  resume(): void {
    if (this.status !== 'paused') return
    this.status = 'playing'
  }

  /** 剪斷指定繩子（不影響其餘繩子），已剪過或不存在則忽略 */
  cutRope(ropeId: string): void {
    if (this.status !== 'playing') return
    const rope = this.ropes.find((r) => r.id === ropeId)
    if (rope) rope.attached = false
  }

  /** 失敗重試：保留 totalScore/totalStars，只重建目前這關（不清空整局進度） */
  private retryLevel(): void {
    this.loadLevel()
  }

  /** 推進物理一個 tick：重力 → 每條附著繩子的距離約束 → 邊界反彈 → 星星／終點／尖刺／掉出畫面判定 */
  tick(dtMs: number): CutTheRopeTickResult {
    const result: CutTheRopeTickResult = { starCollected: false, levelCleared: false, failed: false, allCleared: false, levelScoreGained: 0 }
    if (this.status !== 'playing') return result

    const dt = dtMs / 16
    const c = this.candy
    c.vy += CTR_GRAVITY * dt
    c.x += c.vx * dt
    c.y += c.vy * dt

    for (const rope of this.ropes) {
      if (!rope.attached) continue
      const dx = c.x - rope.anchor.x
      const dy = c.y - rope.anchor.y
      const d = Math.hypot(dx, dy) || 0.0001
      if (d > rope.length) {
        const nx = dx / d
        const ny = dy / d
        c.x = rope.anchor.x + nx * rope.length
        c.y = rope.anchor.y + ny * rope.length
        const radialSpeed = c.vx * nx + c.vy * ny
        c.vx -= radialSpeed * nx
        c.vy -= radialSpeed * ny
      }
    }

    if (c.x < CANDY_RADIUS) {
      c.x = CANDY_RADIUS
      c.vx = Math.abs(c.vx) * WALL_RESTITUTION
    } else if (c.x > CTR_STAGE_WIDTH - CANDY_RADIUS) {
      c.x = CTR_STAGE_WIDTH - CANDY_RADIUS
      c.vx = -Math.abs(c.vx) * WALL_RESTITUTION
    }
    if (c.y < CANDY_RADIUS) {
      c.y = CANDY_RADIUS
      c.vy = Math.abs(c.vy) * WALL_RESTITUTION
    }

    for (const star of this.stars) {
      if (star.collected) continue
      if (dist(c, star.pos) <= CANDY_RADIUS + STAR_RADIUS) {
        star.collected = true
        this.starsThisAttempt += 1
        result.starCollected = true
        this.message = 'star'
      }
    }

    for (const spike of this.spikes) {
      if (dist(c, spike) <= CANDY_RADIUS + SPIKE_RADIUS) {
        result.failed = true
        this.message = 'failed'
        this.retryLevel()
        return result
      }
    }

    if (dist(c, this.goal) <= CANDY_RADIUS + GOAL_RADIUS) {
      const levelScore = LEVEL_CLEAR_BASE_SCORE + this.starsThisAttempt * SCORE_PER_STAR
      this.totalScore += levelScore
      this.totalStars += this.starsThisAttempt
      result.levelCleared = true
      result.levelScoreGained = levelScore
      this.message = 'cleared'

      if (this.levelIndex >= TOTAL_LEVELS) {
        this.status = 'gameover'
        result.allCleared = true
        return result
      }

      this.levelIndex += 1
      this.loadLevel()
      return result
    }

    if (c.y > CTR_STAGE_HEIGHT + CANDY_RADIUS * 4) {
      result.failed = true
      this.message = 'failed'
      this.retryLevel()
      return result
    }

    return result
  }

  /** 對外回傳純資料快照（頁面用 reactive() 鏡像） */
  getSnapshot(): CutTheRopeSnapshot {
    return {
      status: this.status,
      levelIndex: this.levelIndex,
      candy: { ...this.candy },
      ropes: this.ropes.map((r) => ({ ...r, anchor: { ...r.anchor } })),
      stars: this.stars.map((s) => ({ ...s, pos: { ...s.pos } })),
      goal: { ...this.goal },
      spikes: this.spikes.map((s) => ({ ...s })),
      starsThisAttempt: this.starsThisAttempt,
      totalScore: this.totalScore,
      totalStars: this.totalStars,
      message: this.message
    }
  }
}
