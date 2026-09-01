/**
 * FLAPPY 遊戲核心邏輯（純 TypeScript，完全不依賴 Vue／DOM，見 design.md Decision 3）。
 *
 * 與 runner 的關鍵差異（design.md Decision 1／2）：
 *   - 物理：runner 的跳躍是「固定時長拋物線動畫、落地回 standing」的離散動作；FLAPPY 沒有地面可站，
 *     採「速度累加」的連續重力積分（每 tick `velocityY += gravity`、`playerY += velocityY`），
 *     `flap()` 直接「覆寫」垂直速度（不疊加），避免連續快速點擊把速度疊到飛出畫面（spec 明確要求）。
 *   - 障礙物：runner 的 Obstacle 是單一矩形；FLAPPY 的 Pipe 是「上管＋中間 gap＋下管」的成對結構，
 *     `passed` 旗標綁在同一筆 Pipe 上，確保同一組管道只計分一次。
 *
 * 頁面（flappy.vue）以 `reactive()` 鏡像 `getSnapshot()` 的純資料，template 只負責把座標映射成
 * 絕對定位的 `<div>`（比照 runner 的 obstacleStyle inline style），Logic 與 Rendering 分離。
 */

// ── 舞台尺寸與地板／天花板（集中管理，需求「遊戲參數集中管理」）──
export const STAGE_WIDTH = 400
export const STAGE_HEIGHT = 500
/** 底部裝飾地面帶的高度；碰撞地板（FLOOR_Y）即取在這條地面帶的頂緣，讓角色「落地」視覺與判定一致 */
export const GROUND_HEIGHT = 28
/** 碰撞用地板 y 座標（角色下緣 >= 此值即觸底 Game Over），同時也是管道下段的延伸底界 */
export const FLOOR_Y = STAGE_HEIGHT - GROUND_HEIGHT
/** 天花板 y 座標（撞頂只夾住位置、不 Game Over，見 design.md Decision 5） */
export const CEILING_Y = 0

// ── 角色（固定 x，只在 y 軸移動）──
export const PLAYER_X = 92
export const PLAYER_WIDTH = 34
export const PLAYER_HEIGHT = 28
/** 開局角色 y（略高於遊玩區中線，留一點反應空間）；reset 時歸位到此值、velocityY 歸零 */
export const PLAYER_START_Y = 196

// ── 物理參數 ──
/** 重力：每 tick 累加到 velocityY 的向下加速度（向下為正） */
export const GRAVITY = 0.5
/** 跳躍衝力：flap() 時「直接覆寫」velocityY 的值（向上為負，不疊加，見 spec「連續快速操作不疊加」） */
export const JUMP_VELOCITY = -8
/** 終端下墜速度上限：夾住 velocityY 避免下墜過快穿透管道（tunneling），並讓手感可控 */
export const MAX_FALL_SPEED = 11

// ── 捲動速度（隨分數連續內插、夾住上限，見 design.md Decision 2）──
export const BASE_SCROLL_SPEED = 2.4
export const SCROLL_SPEED_PER_POINT = 0.05
export const MAX_SPEED = 5.4

// ── 管道（成對結構＋中間固定 gap）──
export const PIPE_WIDTH = 62
/** 上下管之間的空隙高度（固定值） */
export const PIPE_GAP = 150
/** gapTop 隨機範圍的上下留白，避免空隙貼頂或貼底 */
export const GAP_MARGIN = 52
/** 相鄰兩組管道的水平間距（以捲動距離累積觸發生成，確保間距不受速度影響而恆定） */
export const PIPE_SPACING = 220
/** 開局第一組管道提早一點出現（距離門檻較短），避免玩家開場乾等 */
export const FIRST_PIPE_DISTANCE = 140
/** 管道左移超出此邊界即從陣列濾除回收（比照 runner obstacles 的 -20 margin） */
export const OFFSCREEN_MARGIN_LEFT = -40

export type Pipe = {
  id: number
  /** 管道左緣 x 座標，每 tick 左移 scrollSpeed */
  x: number
  /** 上管道底緣＝空隙頂緣（上管道涵蓋 [0, gapTop)） */
  gapTop: number
  /** 空隙高度（固定為 PIPE_GAP）；下管道涵蓋 [gapTop + gapHeight, FLOOR_Y) */
  gapHeight: number
  width: number
  /** 是否已計分，防止同一組管道重複計分（見 design.md Decision 1） */
  passed: boolean
}

export type Player = {
  /** 角色上緣 y 座標 */
  y: number
  /** 垂直速度（向下為正） */
  velocityY: number
}

export type FlappySnapshot = {
  playerY: number
  velocityY: number
  pipes: Pipe[]
  score: number
  scrollSpeed: number
  gameOver: boolean
}

export type StepResult = { gameOver: boolean }

/** 捲動速度公式（見 design.md Decision 2）：隨分數連續提升，夾住 MAX_SPEED 上限 */
export const scrollSpeedForScore = (score: number): number =>
  Math.min(MAX_SPEED, BASE_SCROLL_SPEED + score * SCROLL_SPEED_PER_POINT)

/** 兩矩形是否重疊（AABB），供碰撞判定共用 */
export const rectsOverlap = (
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by

/**
 * 生成一組管道（見 design.md Decision 1／tasks 5.3）：x 起始於舞台右緣、gapTop 在合理範圍內隨機。
 * rng 可注入（預設 Math.random），供單元測試驗證 gapTop 落在 [GAP_MARGIN, FLOOR_Y - PIPE_GAP - GAP_MARGIN]。
 */
export const spawnPipe = (id: number, rng: () => number = Math.random): Pipe => {
  const minTop = GAP_MARGIN
  const maxTop = FLOOR_Y - PIPE_GAP - GAP_MARGIN
  const gapTop = minTop + rng() * (maxTop - minTop)
  return { id, x: STAGE_WIDTH, gapTop, gapHeight: PIPE_GAP, width: PIPE_WIDTH, passed: false }
}

/**
 * 碰撞判定（純函式，集中管理，見 design.md Decision 5／tasks 5.5）：
 * 角色矩形 vs (a) 觸底地面 (b) 任一管道上段 (c) 任一管道下段，任一成立即回傳 true。
 * ⚠️ 撞頂（playerY <= 0）不在此判定，改由 step() 夾住位置、不算 Game Over。
 */
export const checkCollision = (player: Player, pipes: Pipe[]): boolean => {
  const px = PLAYER_X
  const py = player.y
  const pw = PLAYER_WIDTH
  const ph = PLAYER_HEIGHT

  // (a) 觸底地面
  if (py + ph >= FLOOR_Y) return true

  for (const pipe of pipes) {
    // (b) 上管道：[0, gapTop)
    if (rectsOverlap(px, py, pw, ph, pipe.x, 0, pipe.width, pipe.gapTop)) return true
    // (c) 下管道：[gapTop + gapHeight, FLOOR_Y)
    const bottomTop = pipe.gapTop + pipe.gapHeight
    if (rectsOverlap(px, py, pw, ph, pipe.x, bottomTop, pipe.width, FLOOR_Y - bottomTop)) return true
  }
  return false
}

/**
 * 計分（見 design.md Decision 1／tasks 5.6）：管道右緣完全越過角色左緣（`x + width < PLAYER_X`）
 * 且該組尚未計分時，標記 `passed = true` 並計一分。就地修改傳入 pipes 的 passed 旗標，回傳本次新得分數。
 * 因為只在 `!passed` 時才計分並立即翻旗，同一組管道保證只計一次（spec「不會重複計分」）。
 */
export const checkPassed = (pipes: Pipe[]): number => {
  let gained = 0
  for (const pipe of pipes) {
    if (!pipe.passed && pipe.x + pipe.width < PLAYER_X) {
      pipe.passed = true
      gained += 1
    }
  }
  return gained
}

/**
 * FLAPPY 引擎：整合 Player 物理／Pipe 生成回收／Collision／Score／Game State（見 tasks 5.7）。
 * 頁面以 `getSnapshot()` 取得純資料鏡像，不直接觸碰內部欄位。
 */
export default class FlappyEngine {
  private playerY = PLAYER_START_Y
  private velocityY = 0
  private pipes: Pipe[] = []
  private score = 0
  private over = false
  /** 距上次生成管道累積的捲動距離，達門檻即生成（距離制→水平間距恆定，不受速度影響） */
  private distanceSinceSpawn = 0
  private firstPipeSpawned = false
  private nextPipeId = 1

  constructor() {
    this.reset()
  }

  /** 完整重置所有對局狀態（見 spec「Restart 完整重置」），不殘留上一局資料 */
  reset(): void {
    this.playerY = PLAYER_START_Y
    this.velocityY = 0
    this.pipes = []
    this.score = 0
    this.over = false
    this.distanceSinceSpawn = 0
    this.firstPipeSpawned = false
    this.nextPipeId = 1
  }

  /** 給予一次性向上衝力：直接覆寫 velocityY（不疊加），連續快速呼叫也只維持單次衝力值 */
  flap(): void {
    if (this.over) return
    this.velocityY = JUMP_VELOCITY
  }

  /** 目前捲動速度（隨分數提升、夾住上限） */
  private currentScrollSpeed(): number {
    return scrollSpeedForScore(this.score)
  }

  /**
   * 推進一個 tick：物理積分 → 管道捲動 → 生成 → 計分 → 回收 → 碰撞判定（固定順序）。
   * 回傳本 tick 是否造成 Game Over。已結束（over）時直接回傳 gameOver 不再推進。
   */
  step(): StepResult {
    if (this.over) return { gameOver: true }

    // 1. 玩家物理積分（連續重力，見 design.md Decision 2）
    this.velocityY += GRAVITY
    if (this.velocityY > MAX_FALL_SPEED) this.velocityY = MAX_FALL_SPEED
    this.playerY += this.velocityY

    // 撞頂夾住：歸零位置並清除向上殘餘速度（velocityY = max(0, velocityY)），不算 Game Over（Decision 5）
    if (this.playerY <= CEILING_Y) {
      this.playerY = CEILING_Y
      this.velocityY = Math.max(0, this.velocityY)
    }

    // 2. 管道捲動
    const speed = this.currentScrollSpeed()
    for (const pipe of this.pipes) pipe.x -= speed

    // 3. 生成新管道（距離制，水平間距恆定）
    this.distanceSinceSpawn += speed
    const threshold = this.firstPipeSpawned ? PIPE_SPACING : FIRST_PIPE_DISTANCE
    if (this.distanceSinceSpawn >= threshold) {
      this.pipes.push(spawnPipe(this.nextPipeId++))
      this.distanceSinceSpawn = 0
      this.firstPipeSpawned = true
    }

    // 4. 計分（同一組只計一次）
    this.score += checkPassed(this.pipes)

    // 5. 回收超出畫面左側的管道
    this.pipes = this.pipes.filter((pipe) => pipe.x + pipe.width > OFFSCREEN_MARGIN_LEFT)

    // 6. 碰撞判定
    const hit = checkCollision({ y: this.playerY, velocityY: this.velocityY }, this.pipes)
    if (hit) this.over = true

    return { gameOver: hit }
  }

  /** 對外回傳純資料快照（深拷貝 pipes，頁面用 reactive() 鏡像） */
  getSnapshot(): FlappySnapshot {
    return {
      playerY: this.playerY,
      velocityY: this.velocityY,
      pipes: this.pipes.map((pipe) => ({ ...pipe })),
      score: this.score,
      scrollSpeed: this.currentScrollSpeed(),
      gameOver: this.over
    }
  }
}
