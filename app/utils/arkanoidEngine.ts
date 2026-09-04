/**
 * ARKANOID 遊戲核心邏輯（純 TypeScript，完全不依賴 Vue／DOM，見 add-arkanoid-game/design.md）。
 *
 * ARKANOID 是 BREAKOUT 的進階版：本檔「獨立實作」（design.md Decision 1 已拍板方案 b），
 * 僅參考 breakout.vue 的球物理／AABB 碰撞／擋板 clamp 等核心公式並重新撰寫一份，
 * 不 import 也不修改 breakout.vue／其他遊戲的 engine。差異化項目：
 *   - Multi-Hit Brick（design.md Decision 2）：磚塊 `hitPoints` 遞減至 0 才摧毀，中途只切換視覺。
 *   - Moving Brick（Decision 3）：磚塊在自身欄位左右鄰近空格範圍 [minX,maxX] 內來回，邊界反向，
 *     不與其他磚塊重疊（範圍由 build 期掃描同列空格計算，並以靜態磚塊作為分隔避免兩顆移動磚塊互撞）。
 *   - Power-Up（Decision 4，本次只做 WIDE／MULTI_BALL／SLOW，FIRE 留待下一版）：磚塊摧毀時
 *     依機率掉落膠囊，擋板接住即生效；WIDE／SLOW 限時 8 秒，MULTI_BALL 即時分裂。
 *   - Multi Ball（Decision 5）：`balls: BallAk[]` 陣列，每顆球各自判定；**只有 `balls.length === 0`
 *     （所有球都離開場地）才扣一命**，不是任一顆落地就扣命。
 *   - Combo（Decision 6）：每次命中磚塊 +1，碰到擋板或失去一命即歸零，倍率套用在摧毀得分上。
 *
 * 座標採「螢幕式」局部座標：y=0 在舞台頂端、向下遞增（掉落＝y 增加），與 breakout 一致。
 * 型別刻意採 arkanoid 專屬命名（以免與其他 utils 的 auto-import 型別撞名，比照 towerStackEngine 的處理）。
 */

// ── 對外狀態型別 ──
/** engine 不持有 phase；ready/countdown/pause/gameover 一律由頁面層管理（比照 breakout.vue） */
export type ArkanoidPhase = 'ready' | 'playing' | 'pause' | 'gameover'
/** 單顆球：各自帶速度向量與是否已發射（未發射時黏在擋板上，等玩家按空白鍵） */
export type BallAk = { id: number; x: number; y: number; vx: number; vy: number; launched: boolean }
/**
 * 磚塊：`hitPoints` 為剩餘命中次數（Multi-Hit），`maxHitPoints` 供計分層數加成與視覺分層；
 * `moving` 存在時為 Moving Brick，於 [minX,maxX] 間水平來回（design.md Decision 3）。
 */
export type Brick = {
  id: number
  row: number
  col: number
  x: number
  y: number
  width: number
  height: number
  hitPoints: number
  maxHitPoints: number
  moving?: { minX: number; maxX: number; speed: number; direction: 1 | -1 }
}
/** 本次只做 3 種 Power-Up（FIRE 留待下一版，見 design.md Non-Goals） */
export type PowerUpType = 'WIDE' | 'MULTI_BALL' | 'SLOW'
/** 掉落中的 Power-Up 膠囊 */
export type PowerUp = { id: number; type: PowerUpType; x: number; y: number }

export type ArkanoidBrickHit = { x: number; y: number; destroyed: boolean; scoreDelta: number }

/** step() 的結果，供頁面決定後續 UI（碎屑／訊息／結算 overlay 等） */
export type ArkanoidStepResult = {
  /** 生命歸零，本局結束 */
  gameOver: boolean
  /** 本 tick 所有球皆離開場地，扣一命（可能仍有剩餘生命） */
  lifeLost: boolean
  /** 清光整關磚塊，已切換到下一關 */
  levelCleared: boolean
  /** 本 tick 內發生的磚塊命中（可能多顆球同時命中，故為陣列） */
  brickHits: ArkanoidBrickHit[]
  /** 本 tick 有球擊中擋板（Combo 已因此歸零） */
  paddleBounced: boolean
  /** 本 tick 擋板接住並生效的 Power-Up 類型 */
  powerUpsCollected: PowerUpType[]
}

export type ArkanoidSnapshot = {
  paddleX: number
  paddleWidth: number
  balls: Array<{ id: number; x: number; y: number; launched: boolean }>
  bricks: Array<{
    id: number
    x: number
    y: number
    width: number
    height: number
    hitPoints: number
    maxHitPoints: number
    moving: boolean
  }>
  powerUps: Array<{ id: number; type: PowerUpType; x: number; y: number }>
  score: number
  level: number
  lives: number
  combo: number
  maxCombo: number
  comboMultiplier: number
  /** WIDE 剩餘毫秒（0 = 未生效），供 HUD 倒數顯示 */
  wideMsLeft: number
  /** SLOW 剩餘毫秒（0 = 未生效） */
  slowMsLeft: number
  /** 是否有尚未發射的球（頁面據此提示「按空白鍵發球」） */
  hasUnlaunched: boolean
}

// ── 舞台與物理常數（集中管理，頁面渲染與 engine 共用同一份，不重複硬編碼）──
export const AK_TICK_MS = 16
export const AK_STAGE_WIDTH = 400
export const AK_STAGE_HEIGHT = 460

export const PADDLE_WIDTH = 72
export const PADDLE_HEIGHT = 12
export const PADDLE_Y = AK_STAGE_HEIGHT - 28
export const PADDLE_SPEED = 6
/** WIDE 生效時的擋板寬度倍率 */
export const PADDLE_WIDE_MULTIPLIER = 1.5

export const BALL_SIZE = 10
export const BALL_BASE_SPEED = 3
export const BALL_MAX_BOUNCE_VX = 4.2
const BALL_SPEED_GROWTH = 0.012
const BALL_SPEED_GROWTH_CAP = 0.4

export const BRICK_COLS = 10
export const BRICK_WIDTH = 32
export const BRICK_HEIGHT = 14
export const BRICK_GAP_X = 4
export const BRICK_GAP_Y = 6
export const BRICK_TOP = 40
const BRICK_STEP_X = BRICK_WIDTH + BRICK_GAP_X

export const LIVES_START_AK = 3

// ── 集中管理的差異化參數（見 design.md Decision 4／6）──
export const ARKANOID_CONFIG = {
  /** 磚塊摧毀時掉落 Power-Up 的機率（design.md Decision 4 估算 15%） */
  powerUpDropRate: 0.15,
  /** WIDE／SLOW 限時效果的持續毫秒 */
  powerUpDurationMs: 8000,
  /** MULTI_BALL 分裂後的球數上限（design.md Decision 4／5） */
  multiBallMax: 4,
  /** SLOW 生效時的球速倍率 */
  slowMultiplier: 0.6,
  /** 掉落膠囊的垂直下落速度（px/tick） */
  powerUpFallSpeed: 2.4,
  /** 每摧毀一顆磚塊的基礎分 */
  baseBrickScore: 10,
  /** Multi-Hit 每高一階（maxHitPoints−1）的額外加成 */
  multiHitBonusPerTier: 10,
  /** Combo 每累積這麼多次命中，倍率再 +comboMultStep */
  comboStep: 4,
  /** Combo 每一階的倍率增量 */
  comboMultStep: 0.25,
  /** Combo 倍率加成上限（最終倍率上限 = 1 + comboMultCap） */
  comboMultCap: 2
} as const

export const POWER_UP_WIDTH = 22
export const POWER_UP_HEIGHT = 12
/** 移動磚塊單側最多可延伸的空格數（安全上限，避免罕見佈局造成過長移動範圍） */
const MOVING_RANGE_MAX_CELLS = 2
/** 移動磚塊的水平速度（px/tick） */
const MOVING_BRICK_SPEED = 0.7

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/** AABB 相交判定（複製自 breakout 的最小必要純函式，見 design.md Decision 1／方案 b） */
export const overlaps = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/**
 * 擋板反彈：依球擊中擋板的相對位置決定反射角（複製自 breakout 的公式並重新撰寫）。
 * relative ∈ [-1,1]，越靠邊緣水平分量越大；回傳新的 vx/vy（vy 恆向上）。
 */
export const reflectOffPaddle = (
  ballCenterX: number,
  paddleX: number,
  paddleWidth: number
): { vx: number; vy: number } => {
  const relative = (ballCenterX - (paddleX + paddleWidth / 2)) / (paddleWidth / 2)
  return { vx: clamp(relative, -1, 1) * BALL_MAX_BOUNCE_VX, vy: -BALL_BASE_SPEED }
}

/** 將速度向量旋轉 angle 弧度（保持速度大小），供 MULTI_BALL 分裂出發散方向的新球 */
const rotateVelocity = (vx: number, vy: number, angle: number): { vx: number; vy: number } => {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return { vx: vx * cos - vy * sin, vy: vx * sin + vy * cos }
}

/**
 * 關卡佈局：每一列為 BRICK_COLS 個字元字串。字元對照：
 *   '.' 空、'1'/'2'/'3' 靜態磚塊（hitPoints）、'a'/'b'/'c' 移動磚塊（hitPoints 1/2/3）。
 * 移動磚塊一律以「移動磚塊 + 空格 + 靜態磚塊」的區塊排列，確保每顆移動磚塊有專屬空格、
 * 且以靜態磚塊分隔避免兩顆移動磚塊移入同一空格（見 design.md Decision 3）。
 * Moving Brick 從 Level 3 起才出現（關卡門檻，見 design.md MVP 順序第 5 步）。
 */
export const ARKANOID_LEVELS: Array<{ pattern: string[]; ballSpeedMul: number }> = [
  {
    pattern: ['1111111111', '1111111111', '1111111111', '1111111111'],
    ballSpeedMul: 1
  },
  {
    pattern: ['2222222222', '1111111111', '1111111111', '1111111111', '1111111111'],
    ballSpeedMul: 1.1
  },
  {
    pattern: ['3333333333', '2222222222', 'a.1a.1a.1.', '1111111111', '1111111111'],
    ballSpeedMul: 1.25
  },
  {
    pattern: ['3333333333', 'b.2b.2b.2.', '2222222222', 'a.1a.1a.1.', '1111111111'],
    ballSpeedMul: 1.4
  },
  {
    pattern: ['b.cb.cb.c.', '3333333333', '2222222222', 'a.1a.1a.1.', '1111111111', '1111111111'],
    ballSpeedMul: 1.55
  }
]

const BRICK_CHAR_MAP: Record<string, { hitPoints: number; moving: boolean }> = {
  '1': { hitPoints: 1, moving: false },
  '2': { hitPoints: 2, moving: false },
  '3': { hitPoints: 3, moving: false },
  a: { hitPoints: 1, moving: true },
  b: { hitPoints: 2, moving: true },
  c: { hitPoints: 3, moving: true }
}

/** 磚塊區左緣 x（整區水平置中） */
const bricksStartX = (): number => (AK_STAGE_WIDTH - (BRICK_COLS * BRICK_WIDTH + (BRICK_COLS - 1) * BRICK_GAP_X)) / 2

/**
 * 計算移動磚塊在同一列的可移動範圍 [minX,maxX]（見 design.md Decision 3）：
 * 由該磚塊原始欄位往左／右掃描「連續空格」數（遇到任何被佔用欄位即停），
 * 各方向最多延伸 MOVING_RANGE_MAX_CELLS 格，確保只移入真正的空格、不與其他磚塊重疊。
 * 純函式，供單元測試直接驗證。
 */
export const computeMovingRange = (
  occupiedCols: boolean[],
  col: number,
  originalX: number
): { minX: number; maxX: number } => {
  let left = 0
  for (let cc = col - 1; cc >= 0 && !occupiedCols[cc] && left < MOVING_RANGE_MAX_CELLS; cc -= 1) left += 1
  let right = 0
  for (
    let cc = col + 1;
    cc < occupiedCols.length && !occupiedCols[cc] && right < MOVING_RANGE_MAX_CELLS;
    cc += 1
  )
    right += 1
  const minX = clamp(originalX - left * BRICK_STEP_X, 0, AK_STAGE_WIDTH - BRICK_WIDTH)
  const maxX = clamp(originalX + right * BRICK_STEP_X, 0, AK_STAGE_WIDTH - BRICK_WIDTH)
  return { minX, maxX }
}

/**
 * ArkanoidEngine（見 tasks 5.10）：整合 Paddle／Ball／Brick／Power-Up／Multi Ball／Combo／Level。
 * tick-driven（step 驅動），純 TS 不依賴 Vue；頁面以 getSnapshot() 取純資料鏡像。
 * 關鍵欄位刻意設為 public（比照 breakout 的公開欄位風格），方便單元測試直接檢視/佈置狀態。
 */
export class ArkanoidEngine {
  paddleX = AK_STAGE_WIDTH / 2 - PADDLE_WIDTH / 2
  balls: BallAk[] = []
  bricks: Brick[] = []
  powerUps: PowerUp[] = []
  score = 0
  level = 1
  lives = LIVES_START_AK
  combo = 0
  maxCombo = 0
  wideMsLeft = 0
  slowMsLeft = 0
  /**
   * 測試用：開啟後失去一命不再扣血、也不會 gameOver（僅供除錯，比照 reset()／jumpToLevel()
   * 皆不觸碰此欄位，讓開關獨立於對局重置之外，切換方式與時機由頁面層決定）。
   */
  infiniteLives = false

  private speedMul = 1
  private nextBallId = 1
  private nextBrickId = 1
  private nextPowerUpId = 1
  private readonly rng: () => number

  /** rng 可注入以利單元測試決定性驗證掉落／分裂；預設 Math.random */
  constructor(rng: () => number = Math.random) {
    this.rng = rng
    this.reset()
  }

  /** 完整重置所有對局狀態（見 spec Restart 規格／tasks 6.8）：不殘留任何上一局資料 */
  reset(): void {
    this.paddleX = AK_STAGE_WIDTH / 2 - PADDLE_WIDTH / 2
    this.score = 0
    this.level = 1
    this.lives = LIVES_START_AK
    this.combo = 0
    this.maxCombo = 0
    this.wideMsLeft = 0
    this.slowMsLeft = 0
    this.powerUps = []
    this.nextBallId = 1
    this.nextBrickId = 1
    this.nextPowerUpId = 1
    this.buildBricks(this.level)
    this.balls = [this.spawnBallOnPaddle()]
  }

  /**
   * 測試用：直接跳到指定關卡開局，略過「必須清光磚塊才能進下一關」的正常流程
   * （不是正式玩法，僅供關卡佈局／Moving Brick／難度曲線等除錯用）。
   * 比照 reset()，會歸零分數／生命／Combo／限時效果／Power-Up，避免測試分數混進正式紀錄。
   */
  jumpToLevel(level: number): void {
    const clamped = clamp(Math.floor(level), 1, ARKANOID_LEVELS.length)
    this.score = 0
    this.lives = LIVES_START_AK
    this.combo = 0
    this.maxCombo = 0
    this.wideMsLeft = 0
    this.slowMsLeft = 0
    this.powerUps = []
    this.level = clamped
    this.buildBricks(clamped)
    this.balls = [this.spawnBallOnPaddle()]
  }

  /** 目前擋板寬度（WIDE 生效時放大） */
  paddleWidth(): number {
    return this.wideMsLeft > 0 ? PADDLE_WIDTH * PADDLE_WIDE_MULTIPLIER : PADDLE_WIDTH
  }

  /** 目前球速倍率（含 SLOW 效果），供顯示與位移計算 */
  private effectiveSpeedMul(): number {
    return this.speedMul * (this.slowMsLeft > 0 ? ARKANOID_CONFIG.slowMultiplier : 1)
  }

  /** Combo 倍率（design.md Decision 6）：每 comboStep 次命中 +comboMultStep，封頂 comboMultCap */
  comboMultiplier(): number {
    const steps = Math.floor(this.combo / ARKANOID_CONFIG.comboStep)
    return 1 + Math.min(steps * ARKANOID_CONFIG.comboMultStep, ARKANOID_CONFIG.comboMultCap)
  }

  private levelConfig(level: number) {
    const idx = Math.min(level - 1, ARKANOID_LEVELS.length - 1)
    const base = ARKANOID_LEVELS[idx]!
    const extra = Math.max(0, level - ARKANOID_LEVELS.length) * 0.1
    return { pattern: base.pattern, ballSpeedMul: base.ballSpeedMul + extra }
  }

  private buildBricks(level: number): void {
    const cfg = this.levelConfig(level)
    const startX = bricksStartX()
    const bricks: Brick[] = []
    cfg.pattern.forEach((rowStr, row) => {
      const occupied: boolean[] = []
      for (let col = 0; col < BRICK_COLS; col += 1) occupied[col] = (rowStr[col] ?? '.') !== '.'
      for (let col = 0; col < BRICK_COLS; col += 1) {
        const char = rowStr[col] ?? '.'
        const def = BRICK_CHAR_MAP[char]
        if (!def) continue
        const x = startX + col * BRICK_STEP_X
        const y = BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP_Y)
        const brick: Brick = {
          id: this.nextBrickId++,
          row,
          col,
          x,
          y,
          width: BRICK_WIDTH,
          height: BRICK_HEIGHT,
          hitPoints: def.hitPoints,
          maxHitPoints: def.hitPoints
        }
        if (def.moving) {
          const range = computeMovingRange(occupied, col, x)
          // 範圍寬度為 0（無空格可移動）時退化為靜態，不掛 moving
          if (range.maxX > range.minX) {
            brick.moving = { minX: range.minX, maxX: range.maxX, speed: MOVING_BRICK_SPEED, direction: 1 }
          }
        }
        bricks.push(brick)
      }
    })
    this.bricks = bricks
    this.speedMul = cfg.ballSpeedMul
  }

  private spawnBallOnPaddle(): BallAk {
    const w = this.paddleWidth()
    return {
      id: this.nextBallId++,
      x: this.paddleX + w / 2 - BALL_SIZE / 2,
      y: PADDLE_Y - BALL_SIZE - 2,
      vx: 0,
      vy: -BALL_BASE_SPEED,
      launched: false
    }
  }

  /** 讓黏在擋板上的球跟隨擋板中心（未發射時） */
  private syncUnlaunchedBalls(): void {
    const w = this.paddleWidth()
    for (const ball of this.balls) {
      if (!ball.launched) {
        ball.x = this.paddleX + w / 2 - BALL_SIZE / 2
        ball.y = PADDLE_Y - BALL_SIZE - 2
      }
    }
  }

  /** WIDE 生效／失效時以擋板中心為錨重新定位並夾住邊界 */
  private recenterPaddle(oldWidth: number, newWidth: number): void {
    const center = this.paddleX + oldWidth / 2
    this.paddleX = clamp(center - newWidth / 2, 0, AK_STAGE_WIDTH - newWidth)
  }

  movePaddle(dir: -1 | 0 | 1): void {
    const w = this.paddleWidth()
    this.paddleX = clamp(this.paddleX + dir * PADDLE_SPEED, 0, AK_STAGE_WIDTH - w)
    this.syncUnlaunchedBalls()
  }

  /** 玩家按空白鍵發射所有尚未發射的球（僅開局／失去一命後的那顆） */
  launchBall(): void {
    for (const ball of this.balls) {
      if (!ball.launched) {
        ball.launched = true
        ball.vx = (this.rng() - 0.5) * 2.4
        ball.vy = -BALL_BASE_SPEED
      }
    }
  }

  /**
   * 立即套用 Power-Up 效果（擋板接住時呼叫；設為 public 以利單元測試直接驗證，見 tasks 9.4/9.5）。
   * WIDE／SLOW 為限時（重複拾取重置倒數，不疊加時長）；MULTI_BALL 即時分裂。
   */
  applyPowerUp(type: PowerUpType): void {
    if (type === 'WIDE') {
      const wasWide = this.wideMsLeft > 0
      this.wideMsLeft = ARKANOID_CONFIG.powerUpDurationMs
      if (!wasWide) this.recenterPaddle(PADDLE_WIDTH, PADDLE_WIDTH * PADDLE_WIDE_MULTIPLIER)
      this.syncUnlaunchedBalls()
      return
    }
    if (type === 'SLOW') {
      this.slowMsLeft = ARKANOID_CONFIG.powerUpDurationMs
      return
    }
    // MULTI_BALL：對當前每顆球各複製 1 顆發散方向的新球，直到達上限（design.md Decision 4/5）
    const existing = [...this.balls]
    for (const source of existing) {
      if (this.balls.length >= ARKANOID_CONFIG.multiBallMax) break
      const baseVx = source.launched ? source.vx : (this.rng() - 0.5) * 2.4
      const baseVy = source.launched ? source.vy : -BALL_BASE_SPEED
      const rotated = rotateVelocity(baseVx, baseVy, 0.5)
      this.balls.push({
        id: this.nextBallId++,
        x: source.x,
        y: source.y,
        vx: rotated.vx,
        vy: rotated.vy,
        launched: true
      })
    }
  }

  private spawnPowerUp(x: number, y: number): void {
    const types: PowerUpType[] = ['WIDE', 'MULTI_BALL', 'SLOW']
    const type = types[Math.floor(this.rng() * types.length)] ?? 'WIDE'
    this.powerUps.push({ id: this.nextPowerUpId++, type, x: x - POWER_UP_WIDTH / 2, y })
  }

  private updateMovingBricks(): void {
    for (const brick of this.bricks) {
      const mv = brick.moving
      if (!mv) continue
      brick.x += mv.speed * mv.direction
      if (brick.x <= mv.minX) {
        brick.x = mv.minX
        mv.direction = 1
      } else if (brick.x >= mv.maxX) {
        brick.x = mv.maxX
        mv.direction = -1
      }
    }
  }

  /** 單顆球撞磚塊：AABB＋最小重疊軸判斷撞擊面，同一 tick 每顆球只處理第一個重疊磚塊 */
  private resolveBrickCollision(ball: BallAk): ArkanoidBrickHit | null {
    const ballBox = { x: ball.x, y: ball.y, w: BALL_SIZE, h: BALL_SIZE }
    for (let i = 0; i < this.bricks.length; i += 1) {
      const brick = this.bricks[i]!
      const box = { x: brick.x, y: brick.y, w: brick.width, h: brick.height }
      if (!overlaps(ballBox, box)) continue

      const overlapX = Math.min(ballBox.x + ballBox.w, box.x + box.w) - Math.max(ballBox.x, box.x)
      const overlapY = Math.min(ballBox.y + ballBox.h, box.y + box.h) - Math.max(ballBox.y, box.y)
      if (overlapX < overlapY) ball.vx *= -1
      else ball.vy *= -1

      brick.hitPoints -= 1
      this.combo += 1
      this.maxCombo = Math.max(this.maxCombo, this.combo)
      const cap = this.levelConfig(this.level).ballSpeedMul + BALL_SPEED_GROWTH_CAP
      this.speedMul = Math.min(this.speedMul + BALL_SPEED_GROWTH, cap)

      const cx = brick.x + brick.width / 2
      const cy = brick.y + brick.height / 2

      // Multi-Hit（design.md Decision 2）：hitPoints > 0 時磚塊維持存在，只切換視覺、不給分不摧毀
      if (brick.hitPoints > 0) {
        return { x: cx, y: cy, destroyed: false, scoreDelta: 0 }
      }

      // hitPoints 歸零：摧毀、給分（基礎＋Multi-Hit 加成）×Combo 倍率、機率掉落 Power-Up
      this.bricks.splice(i, 1)
      const multiHitBonus = (brick.maxHitPoints - 1) * ARKANOID_CONFIG.multiHitBonusPerTier
      const scoreDelta = Math.round((ARKANOID_CONFIG.baseBrickScore + multiHitBonus) * this.comboMultiplier())
      this.score += scoreDelta
      if (this.rng() < ARKANOID_CONFIG.powerUpDropRate) this.spawnPowerUp(cx, cy)
      return { x: cx, y: cy, destroyed: true, scoreDelta }
    }
    return null
  }

  /** 單顆球的位移、牆面反彈、擋板反彈；回傳是否擊中擋板（供 Combo 歸零） */
  private stepBall(ball: BallAk): { paddleBounced: boolean } {
    if (!ball.launched) return { paddleBounced: false }
    const mul = this.effectiveSpeedMul()
    ball.x += ball.vx * mul
    ball.y += ball.vy * mul

    if (ball.x <= 0) {
      ball.x = 0
      ball.vx *= -1
    } else if (ball.x + BALL_SIZE >= AK_STAGE_WIDTH) {
      ball.x = AK_STAGE_WIDTH - BALL_SIZE
      ball.vx *= -1
    }
    if (ball.y <= 0) {
      ball.y = 0
      ball.vy *= -1
    }

    let paddleBounced = false
    const paddleBox = { x: this.paddleX, y: PADDLE_Y, w: this.paddleWidth(), h: PADDLE_HEIGHT }
    const ballBox = { x: ball.x, y: ball.y, w: BALL_SIZE, h: BALL_SIZE }
    if (ball.vy > 0 && overlaps(ballBox, paddleBox)) {
      const reflected = reflectOffPaddle(ball.x + BALL_SIZE / 2, this.paddleX, this.paddleWidth())
      ball.vx = reflected.vx
      ball.vy = reflected.vy
      ball.y = PADDLE_Y - BALL_SIZE
      paddleBounced = true
    }
    return { paddleBounced }
  }

  /** 掉落 Power-Up 膠囊更新：下落、擋板接住即生效、落底移除；回傳本 tick 接住的類型 */
  private updatePowerUps(): PowerUpType[] {
    const collected: PowerUpType[] = []
    const remaining: PowerUp[] = []
    const paddleBox = { x: this.paddleX, y: PADDLE_Y, w: this.paddleWidth(), h: PADDLE_HEIGHT }
    for (const pu of this.powerUps) {
      pu.y += ARKANOID_CONFIG.powerUpFallSpeed
      const puBox = { x: pu.x, y: pu.y, w: POWER_UP_WIDTH, h: POWER_UP_HEIGHT }
      if (overlaps(puBox, paddleBox)) {
        collected.push(pu.type)
        continue
      }
      // 未接住落到場地底部即消失，不影響生命值（design.md Decision 4）
      if (pu.y > AK_STAGE_HEIGHT) continue
      remaining.push(pu)
    }
    this.powerUps = remaining
    for (const type of collected) this.applyPowerUp(type)
    return collected
  }

  /** 限時效果倒數（WIDE／SLOW），WIDE 失效時還原擋板寬度 */
  private updateTimedEffects(): void {
    if (this.slowMsLeft > 0) this.slowMsLeft = Math.max(0, this.slowMsLeft - AK_TICK_MS)
    if (this.wideMsLeft > 0) {
      const next = Math.max(0, this.wideMsLeft - AK_TICK_MS)
      this.wideMsLeft = next
      if (next === 0) {
        this.recenterPaddle(PADDLE_WIDTH * PADDLE_WIDE_MULTIPLIER, PADDLE_WIDTH)
        this.syncUnlaunchedBalls()
      }
    }
  }

  /**
   * tick 驅動（見 tasks 5.7/5.9）：擋板移動 → 限時效果倒數 → 移動磚塊 → 每顆球物理/碰撞 →
   * 移除落底球 →（全部落地才）扣命 → Power-Up 掉落 → 關卡清光判定。
   */
  step(paddleDir: -1 | 0 | 1): ArkanoidStepResult {
    this.movePaddle(paddleDir)
    this.updateTimedEffects()
    this.updateMovingBricks()

    const brickHits: ArkanoidBrickHit[] = []
    let paddleBounced = false
    for (const ball of this.balls) {
      const res = this.stepBall(ball)
      if (res.paddleBounced) paddleBounced = true
      if (ball.launched) {
        const hit = this.resolveBrickCollision(ball)
        if (hit) brickHits.push(hit)
      }
    }
    // 碰到擋板即重置 Combo（design.md Decision 6）
    if (paddleBounced) this.combo = 0

    // 移除離開場地底部的球（design.md Decision 5）
    this.balls = this.balls.filter((ball) => ball.y <= AK_STAGE_HEIGHT)

    // 關卡清光判定（先於扣命，比照 breakout：清光的同一 tick 不因球落地而扣命）
    let levelCleared = false
    if (this.bricks.length === 0) {
      this.level += 1
      this.buildBricks(this.level)
      this.powerUps = []
      this.balls = [this.spawnBallOnPaddle()]
      levelCleared = true
    }

    // 扣命判定：**只有所有球都離開場地（balls.length === 0）才扣一命**（design.md Decision 5）
    // infiniteLives 開啟時（測試用）仍視為 lifeLost（重新發球），但不扣血、不觸發 gameOver。
    let lifeLost = false
    let gameOver = false
    if (!levelCleared && this.balls.length === 0) {
      if (!this.infiniteLives) this.lives -= 1
      this.combo = 0
      lifeLost = true
      if (this.infiniteLives || this.lives > 0) {
        this.balls = [this.spawnBallOnPaddle()]
      } else {
        gameOver = true
      }
    }

    const powerUpsCollected = this.updatePowerUps()

    return { gameOver, lifeLost, levelCleared, brickHits, paddleBounced, powerUpsCollected }
  }

  getSnapshot(): ArkanoidSnapshot {
    return {
      paddleX: this.paddleX,
      paddleWidth: this.paddleWidth(),
      balls: this.balls.map((b) => ({ id: b.id, x: b.x, y: b.y, launched: b.launched })),
      bricks: this.bricks.map((b) => ({
        id: b.id,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        hitPoints: b.hitPoints,
        maxHitPoints: b.maxHitPoints,
        moving: !!b.moving
      })),
      powerUps: this.powerUps.map((p) => ({ id: p.id, type: p.type, x: p.x, y: p.y })),
      score: this.score,
      level: this.level,
      lives: this.lives,
      combo: this.combo,
      maxCombo: this.maxCombo,
      comboMultiplier: this.comboMultiplier(),
      wideMsLeft: this.wideMsLeft,
      slowMsLeft: this.slowMsLeft,
      hasUnlaunched: this.balls.some((b) => !b.launched)
    }
  }
}

export default ArkanoidEngine
