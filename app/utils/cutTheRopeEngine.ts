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
 * 關卡是無限的：LEVEL 1~CURATED_LEVEL_COUNT 是手工設計的固定常數（CUT_THE_ROPE_LEVELS），
 * 之後（LEVEL CURATED_LEVEL_COUNT+1 起）由 generateProceduralLevel() 永久隨機產生新關卡。
 *
 * 程序生成關卡「保證可過關」的做法是建構式（constructive），不是隨機生成後再驗證：
 *   1. 隨機決定單一繩子的錨點／繩長／起始角度，起始距離＝繩長（一開始就是拉直的，避免直墜的
 *      退化情況，跟手工關卡修正 level4/7 時的技巧一樣）。
 *   2. 用「跟 tick() 完全一樣的物理公式」往前模擬一段附著擺盪的軌跡。
 *   3. 在模擬軌跡的中段挑一個「剪繩時機」，從那個時間點的位置/速度繼續模擬剪斷後的自由落體＋
 *      反彈軌跡。
 *   4. 終點／星星都直接放在「模擬出來真的會經過」的座標上——因為整條軌跡是用真實物理公式算出來
 *      的，這組關卡資料在建構的當下就已經證明「在正確時機剪繩」是一個可行解，不需要事後再驗證。
 *   5. 找不到合適軌跡（極少見，例如選到的起始角度剛好很快飛出畫面）時重試幾次，仍失敗則退回
 *      直接沿用某一個手工關卡當保底，確保這個函式永遠會回傳一個保證可過關的關卡。
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
  message: 'none' | 'star' | 'cleared' | 'failed'
}

export type CutTheRopeTickResult = {
  starCollected: boolean
  levelCleared: boolean
  failed: boolean
  levelScoreGained: number
}

// ── 對局常數 ──
export const CTR_STAGE_WIDTH = 360
export const CTR_STAGE_HEIGHT = 520
/** 手工設計關卡的數量（LEVEL 1~此值）；超過之後由 generateProceduralLevel() 永久隨機產生新關卡 */
export const CURATED_LEVEL_COUNT = 10

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
    // 起手距離（139）小於繩長（160），放手先自由落體一小段才拉直繩子，形成鐘擺擺盪；
    // 終點刻意放在「剪繩借到左向擺盪動能後」自由落體會經過的路徑上（見開發時用 tracer 腳本
    // 描出的軌跡：約 tick 24~86 剪繩都能過關），若一開始就直接剪繩（不擺盪）會直墜掉出畫面失敗，
    // 確保真的需要借力才能過關。
    candyStart: { x: 250, y: 110 },
    ropes: [{ anchor: { x: 120, y: 60 }, length: 160 }],
    stars: [{ x: 188, y: 205 }],
    goal: { x: 77, y: 385 }
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

/** 物理模擬一步，公式跟 tick() 完全一樣（重力→(可選)繩子約束→邊界反彈），dt 固定為 1（對應 16ms）；
 *  只給 generateProceduralLevel() 在「建構關卡」時用來描出一條保證可行的軌跡，不影響正式 tick() */
const simulateStep = (s: CandyState, rope: { anchor: Vec2; length: number } | null): CandyState => {
  let { x, y, vx, vy } = s
  vy += CTR_GRAVITY
  x += vx
  y += vy

  if (rope) {
    const dx = x - rope.anchor.x
    const dy = y - rope.anchor.y
    const d = Math.hypot(dx, dy) || 0.0001
    if (d > rope.length) {
      const nx = dx / d
      const ny = dy / d
      x = rope.anchor.x + nx * rope.length
      y = rope.anchor.y + ny * rope.length
      const radialSpeed = vx * nx + vy * ny
      vx -= radialSpeed * nx
      vy -= radialSpeed * ny
    }
  }

  if (x < CANDY_RADIUS) {
    x = CANDY_RADIUS
    vx = Math.abs(vx) * WALL_RESTITUTION
  } else if (x > CTR_STAGE_WIDTH - CANDY_RADIUS) {
    x = CTR_STAGE_WIDTH - CANDY_RADIUS
    vx = -Math.abs(vx) * WALL_RESTITUTION
  }
  if (y < CANDY_RADIUS) {
    y = CANDY_RADIUS
    vy = Math.abs(vy) * WALL_RESTITUTION
  }

  return { x, y, vx, vy }
}

const PROCEDURAL_PRE_CUT_TICKS = 220
const PROCEDURAL_POST_CUT_TICKS = 180
const PROCEDURAL_MIN_POST_CUT_VALID = 40
const PROCEDURAL_MAX_ATTEMPTS = 20

/**
 * 建構式隨機產生一關（見檔頭說明）：先模擬一條「附著擺盪 → 中途剪繩 → 自由落體」的真實軌跡，
 * 終點／星星直接放在這條軌跡實際經過的座標上，等於在產生關卡的當下就已經證明「在正確時機剪繩」
 * 是一個可行解。多次嘗試都湊不出合適軌跡（極少見）時，保底直接沿用一個手工關卡。
 */
export const generateProceduralLevel = (levelIndex: number, random: () => number = Math.random): CutTheRopeLevelDef => {
  for (let attempt = 0; attempt < PROCEDURAL_MAX_ATTEMPTS; attempt += 1) {
    const anchor: Vec2 = {
      x: 70 + random() * (CTR_STAGE_WIDTH - 140),
      y: 50 + random() * 40
    }
    const length = 110 + random() * 80
    // 起始角度：相對正下方左右各最多 60 度，起始距離＝繩長（一開始就是拉直的，釋放後自然擺盪，
    // 避免退化成直墜——手工關卡修正 level4/7 時用的是同一招）
    const angle = (random() * 2 - 1) * (Math.PI / 3)
    const candyStart: Vec2 = {
      x: anchor.x + length * Math.sin(angle),
      y: anchor.y + length * Math.cos(angle)
    }
    if (
      candyStart.x < CANDY_RADIUS + 10 ||
      candyStart.x > CTR_STAGE_WIDTH - CANDY_RADIUS - 10 ||
      candyStart.y < CANDY_RADIUS + 10 ||
      candyStart.y > CTR_STAGE_HEIGHT - CANDY_RADIUS - 10
    ) {
      continue // 起手位置超出畫面，換一組參數重試
    }

    const rope = { anchor, length }
    const preCutPath: CandyState[] = []
    let s: CandyState = { ...candyStart, vx: 0, vy: 0 }
    for (let i = 0; i < PROCEDURAL_PRE_CUT_TICKS; i += 1) {
      s = simulateStep(s, rope)
      preCutPath.push(s)
    }

    // 剪繩時機挑在模擬軌跡的中段，確保已經有足夠擺盪動能才放手
    const cutTick = Math.floor(40 + random() * 120)
    if (cutTick >= preCutPath.length) continue
    const atCut = preCutPath[cutTick]!

    // 從剪繩當下的位置/速度繼續模擬剪斷後的自由落體＋反彈軌跡，掉出畫面就停止
    const postCutPath: CandyState[] = []
    let free: CandyState = { ...atCut }
    for (let i = 0; i < PROCEDURAL_POST_CUT_TICKS; i += 1) {
      free = simulateStep(free, null)
      if (free.y > CTR_STAGE_HEIGHT + CANDY_RADIUS * 4) break
      postCutPath.push(free)
    }
    if (postCutPath.length < PROCEDURAL_MIN_POST_CUT_VALID) continue // 太快掉出畫面，這組參數不適合

    // 終點放在剪繩後軌跡的後段（確保真的會經過），跟起點保持距離避免太簡單
    const goalIdx = Math.floor(postCutPath.length * (0.6 + random() * 0.3))
    const goal: Vec2 = { x: postCutPath[goalIdx]!.x, y: postCutPath[goalIdx]!.y }
    if (dist(goal, candyStart) < 80) continue

    // 星星數量隨關卡數緩慢增加，從整條軌跡（剪繩前+剪繩後）取樣，避開終點與彼此
    const fullPath: Vec2[] = [...preCutPath.slice(0, cutTick), ...postCutPath]
    const starCount = levelIndex < 15 ? 1 : 2
    const stars: Vec2[] = []
    let starAttempts = 0
    while (stars.length < starCount && starAttempts < 40) {
      starAttempts += 1
      const idx = Math.floor(random() * fullPath.length)
      const candidate = fullPath[idx]!
      const tooCloseToGoal = dist(candidate, goal) < 50
      const tooCloseToOtherStar = stars.some((st) => dist(st, candidate) < 50)
      if (!tooCloseToGoal && !tooCloseToOtherStar) stars.push({ x: candidate.x, y: candidate.y })
    }

    // 高關卡數才加尖刺，位置要明顯避開整條軌跡（每 3 個取樣點檢查一次，足夠抓出太近的情況）
    let spikes: Vec2[] | undefined
    if (levelIndex >= 14) {
      const sampledPath = fullPath.filter((_, i) => i % 3 === 0)
      for (let i = 0; i < 15; i += 1) {
        const candidate: Vec2 = {
          x: SPIKE_RADIUS + 20 + random() * (CTR_STAGE_WIDTH - 2 * (SPIKE_RADIUS + 20)),
          y: 150 + random() * (CTR_STAGE_HEIGHT - 250)
        }
        const clearOfPath = sampledPath.every((p) => dist(p, candidate) > CANDY_RADIUS + SPIKE_RADIUS + 18)
        if (clearOfPath) {
          spikes = [candidate]
          break
        }
      }
    }

    return { candyStart, ropes: [{ anchor, length }], stars, goal, spikes }
  }

  // 極少數情況下多次嘗試都湊不出合適軌跡，保底直接沿用一個手工關卡（保證可過關），
  // 用 levelIndex 錯開變化，至少不會每次都掉到同一關
  const fallback = CUT_THE_ROPE_LEVELS[levelIndex % CUT_THE_ROPE_LEVELS.length]!
  return {
    candyStart: { ...fallback.candyStart },
    ropes: fallback.ropes.map((r) => ({ anchor: { ...r.anchor }, length: r.length })),
    stars: fallback.stars.map((st) => ({ ...st })),
    goal: { ...fallback.goal },
    spikes: fallback.spikes?.map((sp) => ({ ...sp }))
  }
}

/** 建構時的固定初始關卡（不吃亂數，關卡本身就是固定資料，天生沒有 hydration mismatch 疑慮） */
export type CutTheRopeEngineOptions = {
  /** 隨機源（測試可注入決定性亂數，方便驗證程序生成關卡），預設 Math.random */
  random?: () => number
}

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
  private random: () => number

  constructor(options: CutTheRopeEngineOptions = {}) {
    this.random = options.random ?? Math.random
  }

  /**
   * LEVEL 1~CURATED_LEVEL_COUNT 用手工關卡（CUT_THE_ROPE_LEVELS），之後永久用
   * generateProceduralLevel() 隨機產生，重建當前關卡的糖果／繩子／星星／終點／尖刺
   */
  private loadLevel(): void {
    const def =
      this.levelIndex <= CURATED_LEVEL_COUNT
        ? CUT_THE_ROPE_LEVELS[this.levelIndex - 1]!
        : generateProceduralLevel(this.levelIndex, this.random)
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

  /** 推進物理一個 tick：重力 → 每條附著繩子的距離約束 → 邊界反彈 → 星星／終點／尖刺／掉出畫面判定 */
  tick(dtMs: number): CutTheRopeTickResult {
    const result: CutTheRopeTickResult = { starCollected: false, levelCleared: false, failed: false, levelScoreGained: 0 }
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
        this.status = 'gameover'
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

      // 關卡無限：過關永遠進到下一關（LEVEL 1~CURATED_LEVEL_COUNT 手工設計，之後永久隨機產生），
      // 沒有「全部過關」這個結束條件，玩家想結束要自己按 END
      this.levelIndex += 1
      this.loadLevel()
      return result
    }

    if (c.y > CTR_STAGE_HEIGHT + CANDY_RADIUS * 4) {
      result.failed = true
      this.message = 'failed'
      this.status = 'gameover'
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
