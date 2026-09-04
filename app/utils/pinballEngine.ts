/**
 * PINBALL 純邏輯核心（不依賴 Vue）。內部依職責分節：
 * 型別/常數 → Upgrade Pool → 物理工具函式 → Flipper → Bumper/Target/Hole → Combo/Fever → Upgrade → PinballEngine class。
 * 所有可調數值集中於本節常數表，計分/物理公式一律讀取 `modifiers`，不寫死在各物件方法內（見 design.md Decision 6/8）。
 */

// ---------------------------------------------------------------------------
// Virtual Coordinate System（design.md Decision 1）
// ---------------------------------------------------------------------------
export const PINBALL_WIDTH = 320
export const PINBALL_HEIGHT = 440

export const LIVES_START_PB = 3
export const BALL_RADIUS = 8
export const FLIPPER_RADIUS = 7
/** 碰撞判定略大於視覺半徑，降低高速球穿透 Flipper 的機率 */
export const FLIPPER_COLLISION_RADIUS = 10
// 需要涵蓋大半桌面寬度，兩支 Flipper 中間只留一個明確的 Death Zone 缺口，
// 否則球只要落在 Pivot 外側（桌面兩側）就會在任何 Flipper 角度下都接觸不到、直接漏球（見實測調校紀錄）
export const FLIPPER_LENGTH = 93
export const FLIPPER_PIVOT_Y = PINBALL_HEIGHT - 70
export const FLIPPER_PIVOT_INSET = 30
/** 左 Flipper 軸心比右邊再往左移 15px */
export const FLIPPER_PIVOT_INSET_LEFT = FLIPPER_PIVOT_INSET - 15
export const BUMPER_RADIUS = 18
export const TARGET_WIDTH = 28
export const TARGET_HEIGHT = 16
export const HOLE_RADIUS = 11
/** Flipper 縮短後兩支中間縫隙變大，補一個固定的方形障礙物擋在縫隙正上方，降低直接漏球的機率 */
export const CENTER_POST_SIZE = 40

const GRAVITY = 0.32
const AIR_FRICTION = 0.999
const MAX_BALL_SPEED = 17
const WALL_RESTITUTION = 0.75
const BUMPER_RESTITUTION = 1.4
const BUMPER_MIN_KICK = 6.4
const TARGET_RESTITUTION = 0.85
const FLIPPER_ANGULAR_SPEED = 0.12 // rad / tick，約 6 ticks（~96ms）完成單程擺動，讓「按一次自動彈起再放下」的動作看得清楚
const FLIPPER_UP_ANGLE = -0.62 // rad，相對 restAngle 的擺動量
const FLIPPER_BASE_KICK = 3.2
const FLIPPER_TANGENT_GAIN = 0.9
// 需要讓 Launcher 的預設彈射弧線可以「不靠 Flipper 也能碰到 Bumper 群」（見開發計畫「不能死路」原則）：
// 從 dock 位置（y≈600）到 Bumper 群（y≈200~260）需上升約 340~400px，
// vy0 = sqrt(2 × GRAVITY × 400) ≈ 16，故 LAUNCH_POWER／MAX_BALL_SPEED 皆抓略高於此值
const LAUNCH_POWER = 16
const LAUNCH_POWER_JITTER = 1.2
// Launcher 從桌面右側發射，需要足夠的水平分量才能讓弧線劃過置中的 Bumper／Target 群，
// 不然球只會沿右側邊界原地起落、永遠打不到任何東西（見實測調校紀錄）
const LAUNCH_VX = -3.2
const LAUNCH_VX_JITTER = 0.6

const COMBO_WINDOW_MS = 2500
const FEVER_COMBO_WINDOW_MULT = 3
const COMBO_MULT_STEP = 0.15
const COMBO_MULT_CAP = 4

const FEVER_DURATION_MS = 5000
const FEVER_SCORE_MULT = 3
const FEVER_BUMPER_KICK_MULT = 1.3

const BUMPER_BASE_SCORE = 100
const TARGET_BASE_SCORE = 200
const HOLE_BASE_SCORE = 1000
const HOLE_COMBO_BONUS = 3
const BUMPER_COMBO_BONUS = 1
const TARGET_COMBO_BONUS = 1

const BUMPER_COIN_CHANCE = 0.05
const HOLE_COIN_REWARD = 5
const FEVER_END_COIN_REWARD = 10
/** 趣味幣每 3 枚兌換 1 顆球，整局最多兌換 3 次 */
const COIN_PER_EXTRA_BALL = 3
const MAX_COIN_EXTRA_BALLS = 3
/** 結算時，沒兌換完（不足 3 枚湊一次）的趣味幣，每枚額外加算的分數 */
const COIN_LEFTOVER_SCORE_BONUS = 2000
/** 側邊導流斜牆半徑（封住 Flipper 根部與外牆之間的縫隙） */
const SIDE_WELL_WALL_RADIUS = 4
const FLIPPER_PIVOT_COLLISION_RADIUS = FLIPPER_COLLISION_RADIUS + 2
const FLIPPER_WELL_NUDGE_SPEED = 1.4
/** 發球道左界：進行中球不可回到右側發球區（dock 在 x≈344） */
const LAUNCH_LANE_TOP_Y = 130
const LAUNCH_LANE_DIVIDER_X = PINBALL_WIDTH - 42

// ---------------------------------------------------------------------------
// 型別
// ---------------------------------------------------------------------------
export type BallPb = { x: number; y: number; vx: number; vy: number; active: boolean }

export type FlipperSide = 'left' | 'right'
export type FlipperAutoPhase = 'idle' | 'up' | 'down'
export type Flipper = {
  side: FlipperSide
  pivotX: number
  pivotY: number
  length: number
  restAngle: number
  activeAngle: number
  angle: number
  angularVelocity: number
  held: boolean
  /** 按一次自動彈起再放下（見 tryTriggerFlip）：idle=可再次觸發、up=正在彈起、down=正在放下 */
  autoPhase: FlipperAutoPhase
}

export type Bumper = { id: number; x: number; y: number; radius: number; flashMsLeft: number }
export type Target = { id: number; label: string; x: number; y: number; hit: boolean; flashMsLeft: number }
export type GoldenHole = { x: number; y: number; radius: number; flashMsLeft: number }
export type CenterPost = { x: number; y: number; size: number; flashMsLeft: number }

export type UpgradeCategory = 'score' | 'combo' | 'control' | 'special'
export type UpgradeModifiers = {
  bumperScoreMult: number
  targetScoreMult: number
  holeScoreMult: number
  feverScoreBonusMult: number
  comboWindowBonusMs: number
  comboMultStepBonus: number
  bumperExtraCombo: number
  flipperLengthMult: number
  flipperKickMult: number
  flipperSwingSpeedMult: number
  bumperCoinChanceBonus: number
  autoFeverAtCombo10: boolean
}

const DEFAULT_MODIFIERS = (): UpgradeModifiers => ({
  bumperScoreMult: 1,
  targetScoreMult: 1,
  holeScoreMult: 1,
  feverScoreBonusMult: 1,
  comboWindowBonusMs: 0,
  comboMultStepBonus: 0,
  bumperExtraCombo: 0,
  flipperLengthMult: 1,
  flipperKickMult: 1,
  flipperSwingSpeedMult: 1,
  bumperCoinChanceBonus: 0,
  autoFeverAtCombo10: false
})

export type Upgrade = {
  id: string
  name: string
  description: string
  category: UpgradeCategory
  apply: (modifiers: UpgradeModifiers) => void
}

/** 12 個 Upgrade，集中管理，數值不分散在各物件方法內（design.md Decision 6） */
export const UPGRADE_POOL: Upgrade[] = [
  { id: 'bumper-score', name: 'BUMPER SCORE +50%', description: '撞擊 Bumper 得分提高 50%', category: 'score', apply: (m) => { m.bumperScoreMult += 0.5 } },
  { id: 'target-score', name: 'TARGET SCORE +50%', description: '撞擊 Target 得分提高 50%', category: 'score', apply: (m) => { m.targetScoreMult += 0.5 } },
  { id: 'hole-score', name: 'GOLDEN HOLE +50%', description: 'Golden Hole 得分提高 50%', category: 'score', apply: (m) => { m.holeScoreMult += 0.5 } },
  { id: 'fever-score', name: 'FEVER SCORE +25%', description: 'Fever 期間得分再提高 25%', category: 'score', apply: (m) => { m.feverScoreBonusMult += 0.25 } },
  { id: 'combo-duration', name: 'COMBO DURATION +2s', description: 'Combo 倒數時間延長 2 秒', category: 'combo', apply: (m) => { m.comboWindowBonusMs += 2000 } },
  { id: 'combo-mult', name: 'COMBO MULTIPLIER +25%', description: 'Combo 倍率成長速度提高 25%', category: 'combo', apply: (m) => { m.comboMultStepBonus += COMBO_MULT_STEP * 0.25 } },
  { id: 'bumper-combo', name: 'BUMPER COMBO +1', description: '撞擊 Bumper 額外獲得 1 點 Combo', category: 'combo', apply: (m) => { m.bumperExtraCombo += 1 } },
  { id: 'flipper-width', name: 'FLIPPER WIDTH +10%', description: 'Flipper 長度增加 10%', category: 'control', apply: (m) => { m.flipperLengthMult += 0.1 } },
  { id: 'flipper-power', name: 'FLIPPER POWER +15%', description: 'Flipper 擊退力道提高 15%', category: 'control', apply: (m) => { m.flipperKickMult += 0.15 } },
  { id: 'flipper-cooldown', name: 'FLIPPER SWING +10%', description: 'Flipper 擺動速度加快 10%', category: 'control', apply: (m) => { m.flipperSwingSpeedMult += 0.1 } },
  { id: 'bumper-bonus-coin', name: 'BUMPER LUCKY COIN', description: '撞擊 Bumper 額外 10% 機率掉落趣味幣', category: 'special', apply: (m) => { m.bumperCoinChanceBonus += 0.1 } },
  { id: 'auto-fever', name: 'AUTO FEVER AT x10', description: 'Combo 達到 x10 時自動觸發短暫 Fever', category: 'special', apply: (m) => { m.autoFeverAtCombo10 = true } }
]

export type PinballStatus = 'ready' | 'playing' | 'pause' | 'upgrade' | 'gameover'

export type PinballSnapshot = {
  status: PinballStatus
  ball: BallPb
  leftFlipper: Flipper
  rightFlipper: Flipper
  bumpers: Bumper[]
  targets: Target[]
  hole: GoldenHole
  centerPost: CenterPost
  score: number
  lives: number
  ballIndex: number
  combo: number
  maxCombo: number
  comboMultiplier: number
  comboMsLeft: number
  feverActive: boolean
  feverMsLeft: number
  feverCount: number
  coinsCollected: number
  coinBonusLivesGranted: number
  finalCoinBonusAmount: number
  finalLeftoverCoinCount: number
  pendingUpgradeChoices: Upgrade[]
  hitFlashes: Array<{ id: number; x: number; y: number; text: string }>
  shakeToken: number
  ballDocked: boolean
}

// ---------------------------------------------------------------------------
// 物理工具函式
// ---------------------------------------------------------------------------
const clampSpeed = (ball: BallPb) => {
  const speed = Math.hypot(ball.vx, ball.vy)
  if (speed > MAX_BALL_SPEED) {
    const scale = MAX_BALL_SPEED / speed
    ball.vx *= scale
    ball.vy *= scale
  }
}

/** 球心到線段最近點的距離與該點座標 */
const closestPointOnSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const abx = bx - ax
  const aby = by - ay
  const lenSq = abx * abx + aby * aby
  let t = lenSq > 0 ? ((px - ax) * abx + (py - ay) * aby) / lenSq : 0
  t = Math.max(0, Math.min(1, t))
  const cx = ax + abx * t
  const cy = ay + aby * t
  return { x: cx, y: cy, dist: Math.hypot(px - cx, py - cy), t }
}

// ---------------------------------------------------------------------------
// PinballEngine
// ---------------------------------------------------------------------------
export default class PinballEngine {
  private ball: BallPb = { x: 0, y: 0, vx: 0, vy: 0, active: false }
  private leftFlipper: Flipper
  private rightFlipper: Flipper
  private bumpers: Bumper[] = []
  private targets: Target[] = []
  private hole: GoldenHole
  private centerPost: CenterPost
  private modifiers: UpgradeModifiers = DEFAULT_MODIFIERS()

  private status: PinballStatus = 'ready'
  private score = 0
  private lives = LIVES_START_PB
  private ballIndex = 1
  private combo = 0
  private maxCombo = 0
  private comboMsLeft = 0
  private feverActive = false
  private feverMsLeft = 0
  private feverCount = 0
  private coinsCollected = 0
  /** 已經兌換成球的次數（每次消耗 3 枚），最多 MAX_COIN_EXTRA_BALLS 次 */
  private coinBonusLivesGranted = 0
  /** 結算時（gameover）算出的「未兌換完趣味幣」加分與剩餘枚數，僅在遊戲結束當下計算一次 */
  private finalCoinBonusAmount = 0
  private finalLeftoverCoinCount = 0
  private pendingUpgradeChoices: Upgrade[] = []
  private ballDocked = true

  private hitFlashes: Array<{ id: number; x: number; y: number; text: string; msLeft: number }> = []
  private flashIdSeq = 1
  private shakeToken = 0

  private leftHeld = false
  private rightHeld = false
  /** 剛發球、球還沒離開發球道時暫時隔絕右 Flipper 碰撞（見 moveBallWithFlipperCollisions 註解），球一離開發球道就恆久解除 */
  private rightLaneLaunchGuard = false

  constructor() {
    this.leftFlipper = this.createFlipper('left')
    this.rightFlipper = this.createFlipper('right')
    this.hole = { x: PINBALL_WIDTH - 40, y: 120, radius: HOLE_RADIUS, flashMsLeft: 0 }
    this.centerPost = { x: (FLIPPER_PIVOT_INSET_LEFT + (PINBALL_WIDTH - FLIPPER_PIVOT_INSET)) / 2, y: 332, size: CENTER_POST_SIZE, flashMsLeft: 0 }
    this.reset()
  }

  private createFlipper(side: FlipperSide): Flipper {
    const pivotY = FLIPPER_PIVOT_Y
    if (side === 'left') {
      return { side, pivotX: FLIPPER_PIVOT_INSET_LEFT, pivotY, length: FLIPPER_LENGTH, restAngle: 0.55, activeAngle: 0.55 + FLIPPER_UP_ANGLE, angle: 0.55, angularVelocity: 0, held: false, autoPhase: 'idle' }
    }
    return { side, pivotX: PINBALL_WIDTH - FLIPPER_PIVOT_INSET, pivotY, length: FLIPPER_LENGTH, restAngle: Math.PI - 0.55, activeAngle: Math.PI - 0.55 - FLIPPER_UP_ANGLE, angle: Math.PI - 0.55, angularVelocity: 0, held: false, autoPhase: 'idle' }
  }

  reset() {
    this.modifiers = DEFAULT_MODIFIERS()
    this.score = 0
    this.lives = LIVES_START_PB
    this.ballIndex = 1
    this.combo = 0
    this.maxCombo = 0
    this.comboMsLeft = 0
    this.feverActive = false
    this.feverMsLeft = 0
    this.feverCount = 0
    this.coinsCollected = 0
    this.coinBonusLivesGranted = 0
    this.finalCoinBonusAmount = 0
    this.finalLeftoverCoinCount = 0
    this.pendingUpgradeChoices = []
    this.hitFlashes = []
    this.status = 'ready'
    this.leftFlipper = this.createFlipper('left')
    this.rightFlipper = this.createFlipper('right')
    this.bumpers = [
      { id: 1, x: PINBALL_WIDTH / 2, y: 200, radius: BUMPER_RADIUS, flashMsLeft: 0 },
      { id: 2, x: PINBALL_WIDTH / 2 - 60, y: 260, radius: BUMPER_RADIUS, flashMsLeft: 0 },
      { id: 3, x: PINBALL_WIDTH / 2 + 60, y: 260, radius: BUMPER_RADIUS, flashMsLeft: 0 }
    ]
    this.targets = [
      { id: 1, label: 'A', x: 60, y: 120, hit: false, flashMsLeft: 0 },
      { id: 2, label: 'B', x: 130, y: 90, hit: false, flashMsLeft: 0 },
      { id: 3, label: 'C', x: 200, y: 90, hit: false, flashMsLeft: 0 },
      { id: 4, label: 'D', x: 270, y: 120, hit: false, flashMsLeft: 0 }
    ]
    this.hole = { x: PINBALL_WIDTH - 34, y: 130, radius: HOLE_RADIUS, flashMsLeft: 0 }
    this.centerPost = { x: (FLIPPER_PIVOT_INSET_LEFT + (PINBALL_WIDTH - FLIPPER_PIVOT_INSET)) / 2, y: 332, size: CENTER_POST_SIZE, flashMsLeft: 0 }
    this.dockBall()
  }

  private dockBall() {
    this.ball = { x: PINBALL_WIDTH - 16, y: PINBALL_HEIGHT - 40, vx: 0, vy: 0, active: false }
    this.ballDocked = true
    this.rightLaneLaunchGuard = false
  }

  /**
   * Flipper 改成「按一次自動彈起再放下」：按下瞬間（rising edge）觸發一次完整的上彈-回落動作，
   * 動作進行中（autoPhase !== 'idle'）不管按住不放或中途連按都不會再觸發，
   * 一定要等這次動作完整放下回到 idle，下一次「按下」才會再生效（見 updateFlipper 的階段轉換）。
   */
  setInput(input: { left: boolean; right: boolean }) {
    this.tryTriggerFlip(this.leftFlipper, this.leftHeld, input.left)
    this.tryTriggerFlip(this.rightFlipper, this.rightHeld, input.right)
    this.leftHeld = input.left
    this.rightHeld = input.right
  }

  private tryTriggerFlip(flipper: Flipper, prevRaw: boolean, nextRaw: boolean) {
    if (!prevRaw && nextRaw && flipper.autoPhase === 'idle') {
      flipper.autoPhase = 'up'
      flipper.held = true
    }
  }

  start() {
    if (this.status === 'ready') this.status = 'playing'
  }

  togglePause() {
    if (this.status === 'playing') this.status = 'pause'
    else if (this.status === 'pause') this.status = 'playing'
  }

  launchBall() {
    if (this.status !== 'playing' && this.status !== 'ready') return
    if (!this.ballDocked) return
    this.status = 'playing'
    this.ballDocked = false
    this.ball.active = true
    this.rightLaneLaunchGuard = true
    this.ball.vy = -(LAUNCH_POWER + (Math.random() - 0.5) * LAUNCH_POWER_JITTER)
    this.ball.vx = LAUNCH_VX + (Math.random() - 0.5) * LAUNCH_VX_JITTER
  }

  applyUpgrade(id: string) {
    const upgrade = UPGRADE_POOL.find((u) => u.id === id)
    if (!upgrade) return
    upgrade.apply(this.modifiers)
    this.pendingUpgradeChoices = []
    this.dockBall()
    this.status = 'playing'
  }

  private pushFlash(x: number, y: number, text: string) {
    this.hitFlashes.push({ id: this.flashIdSeq++, x, y, text, msLeft: 600 })
    if (this.hitFlashes.length > 12) this.hitFlashes.shift()
  }

  private triggerShake() {
    this.shakeToken += 1
  }

  /** 趣味幣每滿 3 枚自動兌換 1 顆球，整局最多兌換 MAX_COIN_EXTRA_BALLS 次；每次收集趣味幣都要檢查一次 */
  private checkCoinBonusLife() {
    const eligible = Math.min(MAX_COIN_EXTRA_BALLS, Math.floor(this.coinsCollected / COIN_PER_EXTRA_BALL))
    if (eligible <= this.coinBonusLivesGranted) return
    const grant = eligible - this.coinBonusLivesGranted
    this.coinBonusLivesGranted = eligible
    this.lives += grant
    this.pushFlash(PINBALL_WIDTH / 2, PINBALL_HEIGHT / 2, grant > 1 ? `+${grant} BALLS` : '+1 BALL')
    this.triggerShake()
  }

  private registerHit(comboGain: number) {
    this.combo += comboGain
    this.maxCombo = Math.max(this.maxCombo, this.combo)
    const baseWindow = COMBO_WINDOW_MS + this.modifiers.comboWindowBonusMs
    this.comboMsLeft = this.feverActive ? baseWindow * FEVER_COMBO_WINDOW_MULT : baseWindow
    if (this.modifiers.autoFeverAtCombo10 && this.combo >= 10 && !this.feverActive) {
      this.triggerFever(4000)
    }
  }

  private comboMultiplier(): number {
    const step = COMBO_MULT_STEP + this.modifiers.comboMultStepBonus
    return Math.min(1 + (this.combo - 1) * step, COMBO_MULT_CAP)
  }

  private addScore(base: number, sourceMult: number) {
    const feverMult = this.feverActive ? FEVER_SCORE_MULT * this.modifiers.feverScoreBonusMult : 1
    const gained = Math.round(base * sourceMult * this.comboMultiplier() * feverMult)
    this.score += gained
    return gained
  }

  private triggerFever(durationMs = FEVER_DURATION_MS) {
    this.feverActive = true
    this.feverMsLeft = durationMs
    this.feverCount += 1
  }

  private endFever() {
    this.feverActive = false
    this.feverMsLeft = 0
    this.targets.forEach((t) => { t.hit = false })
    this.coinsCollected += FEVER_END_COIN_REWARD
    this.checkCoinBonusLife()
  }

  private updateFlipper(flipper: Flipper, dt: number) {
    const targetAngle = flipper.held ? flipper.activeAngle : flipper.restAngle
    const prevAngle = flipper.angle
    const speed = FLIPPER_ANGULAR_SPEED * this.modifiers.flipperSwingSpeedMult * dt
    if (Math.abs(targetAngle - flipper.angle) <= speed) {
      flipper.angle = targetAngle
    } else {
      flipper.angle += targetAngle > flipper.angle ? speed : -speed
    }
    flipper.angularVelocity = (flipper.angle - prevAngle) / dt

    if (flipper.autoPhase === 'up' && flipper.angle === flipper.activeAngle) {
      flipper.autoPhase = 'down'
      flipper.held = false
    } else if (flipper.autoPhase === 'down' && flipper.angle === flipper.restAngle) {
      flipper.autoPhase = 'idle'
    }
  }

  private flipperTip(flipper: Flipper) {
    const length = flipper.length * this.modifiers.flipperLengthMult
    return { x: flipper.pivotX + Math.cos(flipper.angle) * length, y: flipper.pivotY + Math.sin(flipper.angle) * length }
  }

  private resolveFlipperCollision(flipper: Flipper) {
    const tip = this.flipperTip(flipper)
    const { x: cx, y: cy, dist, t } = closestPointOnSegment(this.ball.x, this.ball.y, flipper.pivotX, flipper.pivotY, tip.x, tip.y)
    const minDist = BALL_RADIUS + FLIPPER_COLLISION_RADIUS
    if (dist >= minDist || dist === 0) return
    const nx = (this.ball.x - cx) / dist
    const ny = (this.ball.y - cy) / dist
    this.ball.x = cx + nx * minDist
    this.ball.y = cy + ny * minDist

    const contactRadius = flipper.length * this.modifiers.flipperLengthMult * t
    const tangentialSpeed = flipper.angularVelocity * contactRadius * FLIPPER_TANGENT_GAIN
    const tx = -Math.sin(flipper.angle)
    const ty = Math.cos(flipper.angle)

    const inward = this.ball.vx * nx + this.ball.vy * ny
    this.ball.vx -= 2 * inward * nx
    this.ball.vy -= 2 * inward * ny
    this.ball.vx += nx * FLIPPER_BASE_KICK * this.modifiers.flipperKickMult
    this.ball.vy += ny * FLIPPER_BASE_KICK * this.modifiers.flipperKickMult
    this.ball.vx += tx * tangentialSpeed * this.modifiers.flipperKickMult
    this.ball.vy += ty * tangentialSpeed * this.modifiers.flipperKickMult
    clampSpeed(this.ball)
  }

  /** Flipper 軸心圓形碰撞（補足線段碰不到根部與牆角縫隙） */
  private resolveFlipperPivotCollision(flipper: Flipper) {
    const dx = this.ball.x - flipper.pivotX
    const dy = this.ball.y - flipper.pivotY
    const dist = Math.hypot(dx, dy)
    const minDist = BALL_RADIUS + FLIPPER_PIVOT_COLLISION_RADIUS
    if (dist >= minDist || dist === 0) return
    const nx = dx / dist
    const ny = dy / dist
    this.ball.x = flipper.pivotX + nx * minDist
    this.ball.y = flipper.pivotY + ny * minDist
    const inward = this.ball.vx * nx + this.ball.vy * ny
    if (inward < 0) {
      this.ball.vx -= 2 * inward * nx * WALL_RESTITUTION
      this.ball.vy -= 2 * inward * ny * WALL_RESTITUTION
    }
    clampSpeed(this.ball)
  }

  /** 兩支 Flipper 縮短後中間縫隙變大，補一個固定方形障礙物擋在縫隙正上方，降低球直接漏球的機率（純物理阻擋，不計分） */
  private resolveCenterPost() {
    const half = this.centerPost.size / 2
    const nearestX = Math.max(this.centerPost.x - half, Math.min(this.ball.x, this.centerPost.x + half))
    const nearestY = Math.max(this.centerPost.y - half, Math.min(this.ball.y, this.centerPost.y + half))
    const dx = this.ball.x - nearestX
    const dy = this.ball.y - nearestY
    const dist = Math.hypot(dx, dy)
    if (dist >= BALL_RADIUS || dist === 0) return
    const nx = dx / dist
    const ny = dy / dist
    const penetration = BALL_RADIUS - dist
    this.ball.x += nx * penetration
    this.ball.y += ny * penetration
    const inward = this.ball.vx * nx + this.ball.vy * ny
    if (inward < 0) {
      this.ball.vx -= 2 * inward * nx * WALL_RESTITUTION
      this.ball.vy -= 2 * inward * ny * WALL_RESTITUTION
    }
    clampSpeed(this.ball)
    this.centerPost.flashMsLeft = 200
  }

  /**
   * 左右下角導流斜牆：從外牆底部連到 Flipper 軸心外側，避免球卡在根部縫隙。
   * @param ax 斜牆起點 x
   * @param ay 斜牆起點 y
   * @param bx 斜牆終點 x
   * @param by 斜牆終點 y
   * @param side 左／右側（決定法線朝場內）
   */
  private resolveSideWellWall(ax: number, ay: number, bx: number, by: number, side: FlipperSide) {
    const { x: cx, y: cy, dist } = closestPointOnSegment(this.ball.x, this.ball.y, ax, ay, bx, by)
    const minDist = BALL_RADIUS + SIDE_WELL_WALL_RADIUS
    if (dist >= minDist || dist === 0) return
    let nx = (this.ball.x - cx) / dist
    let ny = (this.ball.y - cy) / dist
    if (side === 'left' && nx < 0) {
      nx = -nx
      ny = -ny
    }
    if (side === 'right' && nx > 0) {
      nx = -nx
      ny = -ny
    }
    this.ball.x = cx + nx * minDist
    this.ball.y = cy + ny * minDist
    const inward = this.ball.vx * nx + this.ball.vy * ny
    if (inward < 0) {
      this.ball.vx -= 2 * inward * nx * WALL_RESTITUTION
      this.ball.vy -= 2 * inward * ny * WALL_RESTITUTION
    }
    clampSpeed(this.ball)
  }

  private resolveSideWellWalls() {
    const wellTopY = FLIPPER_PIVOT_Y + 22
    const bottomY = PINBALL_HEIGHT + BALL_RADIUS
    const leftWellEndX = FLIPPER_PIVOT_INSET_LEFT - 6
    // 右側斜牆終點對齊發球道隔板，避免把球導回右側發球區
    const rightWellEndX = LAUNCH_LANE_DIVIDER_X
    this.resolveSideWellWall(0, bottomY, leftWellEndX, wellTopY, 'left')
    this.resolveSideWellWall(PINBALL_WIDTH, bottomY, rightWellEndX, wellTopY, 'right')
  }

  /** 進行中的球不可穿過發球道隔板回到 plunger 區（僅擋往右移動，剛發球時球本就在發球道內、正往左移動不受影響） */
  private resolveLaunchLaneDivider() {
    if (!this.ball.active || this.ballDocked) return
    if (this.ball.vx <= 0) return
    if (this.ball.y < LAUNCH_LANE_TOP_Y) return
    if (this.ball.x + BALL_RADIUS <= LAUNCH_LANE_DIVIDER_X) return

    this.ball.x = LAUNCH_LANE_DIVIDER_X - BALL_RADIUS - 0.5
    this.ball.vx = -Math.abs(this.ball.vx) * WALL_RESTITUTION
    const speed = Math.hypot(this.ball.vx, this.ball.vy)
    if (speed < FLIPPER_WELL_NUDGE_SPEED) {
      this.ball.vx -= 1.1
      this.ball.vy -= 0.45
      clampSpeed(this.ball)
    }
  }

  /** 低速球若仍卡在 Flipper 井裡，輕推回場內避免永久卡住 */
  private resolveFlipperWellAntiStuck() {
    const speed = Math.hypot(this.ball.vx, this.ball.vy)
    if (speed >= FLIPPER_WELL_NUDGE_SPEED) return
    const wells = [
      { pivotX: FLIPPER_PIVOT_INSET_LEFT, maxX: PINBALL_WIDTH, nudgeX: 0.9, nudgeY: -0.55 },
      {
        pivotX: PINBALL_WIDTH - FLIPPER_PIVOT_INSET,
        maxX: LAUNCH_LANE_DIVIDER_X,
        nudgeX: -1.1,
        nudgeY: -0.55
      }
    ] as const
    for (const well of wells) {
      const inWell = this.ball.y > FLIPPER_PIVOT_Y - 10
        && this.ball.y < PINBALL_HEIGHT
        && Math.abs(this.ball.x - well.pivotX) < 18
        && this.ball.x < well.maxX
      if (!inWell) continue
      this.ball.vx += well.nudgeX
      this.ball.vy += well.nudgeY
      clampSpeed(this.ball)
    }

    // 球若垂直落在方形障礙物正中央（vx 剛好等於 0）會理論上無限平衡在頂面上，輕推破壞對稱性避免卡住
    const half = this.centerPost.size / 2
    const restingOnPost = Math.abs(this.ball.x - this.centerPost.x) < half + 1
      && this.ball.y < this.centerPost.y
      && this.ball.y > this.centerPost.y - half - BALL_RADIUS - 2
    if (restingOnPost) this.ball.vx += this.ball.x >= this.centerPost.x ? 0.6 : -0.6
  }

  private resolveWalls() {
    const b = this.ball
    if (b.x - BALL_RADIUS < 0) { b.x = BALL_RADIUS; b.vx = Math.abs(b.vx) * WALL_RESTITUTION }
    if (b.x + BALL_RADIUS > PINBALL_WIDTH) { b.x = PINBALL_WIDTH - BALL_RADIUS; b.vx = -Math.abs(b.vx) * WALL_RESTITUTION }
    if (b.y - BALL_RADIUS < 0) { b.y = BALL_RADIUS; b.vy = Math.abs(b.vy) * WALL_RESTITUTION }
  }

  private resolveBumpers() {
    for (const bumper of this.bumpers) {
      const dx = this.ball.x - bumper.x
      const dy = this.ball.y - bumper.y
      const dist = Math.hypot(dx, dy)
      const minDist = BALL_RADIUS + bumper.radius
      if (dist >= minDist || dist === 0) continue
      const nx = dx / dist
      const ny = dy / dist
      this.ball.x = bumper.x + nx * minDist
      this.ball.y = bumper.y + ny * minDist
      const speed = Math.max(Math.hypot(this.ball.vx, this.ball.vy) * BUMPER_RESTITUTION, BUMPER_MIN_KICK) * (this.feverActive ? FEVER_BUMPER_KICK_MULT : 1)
      this.ball.vx = nx * speed
      this.ball.vy = ny * speed
      clampSpeed(this.ball)

      bumper.flashMsLeft = 220
      this.registerHit(BUMPER_COMBO_BONUS + this.modifiers.bumperExtraCombo)
      const gained = this.addScore(BUMPER_BASE_SCORE, this.modifiers.bumperScoreMult)
      this.pushFlash(bumper.x, bumper.y, `+${gained}`)
      this.triggerShake()
      if (Math.random() < BUMPER_COIN_CHANCE + this.modifiers.bumperCoinChanceBonus) {
        this.coinsCollected += 1
        this.checkCoinBonusLife()
      }
    }
  }

  private resolveTargets() {
    for (const target of this.targets) {
      if (target.hit) continue
      const halfW = TARGET_WIDTH / 2
      const halfH = TARGET_HEIGHT / 2
      const nearestX = Math.max(target.x - halfW, Math.min(this.ball.x, target.x + halfW))
      const nearestY = Math.max(target.y - halfH, Math.min(this.ball.y, target.y + halfH))
      const dx = this.ball.x - nearestX
      const dy = this.ball.y - nearestY
      const dist = Math.hypot(dx, dy)
      if (dist >= BALL_RADIUS) continue

      target.hit = true
      target.flashMsLeft = 400
      if (dist > 0) {
        const nx = dx / dist
        const ny = dy / dist
        this.ball.vx = (nx * Math.abs(this.ball.vx || 1) + this.ball.vx) * TARGET_RESTITUTION
        this.ball.vy = (ny * Math.abs(this.ball.vy || 1) + this.ball.vy) * TARGET_RESTITUTION
        this.ball.x += nx * 1.5
        this.ball.y += ny * 1.5
      } else {
        this.ball.vy = -Math.abs(this.ball.vy) * TARGET_RESTITUTION
      }
      clampSpeed(this.ball)

      this.registerHit(TARGET_COMBO_BONUS)
      const gained = this.addScore(TARGET_BASE_SCORE, this.modifiers.targetScoreMult)
      this.pushFlash(target.x, target.y, `+${gained}`)

      if (this.targets.every((t) => t.hit) && !this.feverActive) {
        this.triggerFever()
      }
    }
  }

  private resolveHole() {
    const dist = Math.hypot(this.ball.x - this.hole.x, this.ball.y - this.hole.y)
    if (dist >= this.hole.radius) return
    this.hole.flashMsLeft = 500
    this.registerHit(HOLE_COMBO_BONUS)
    const gained = this.addScore(HOLE_BASE_SCORE, this.modifiers.holeScoreMult)
    this.coinsCollected += HOLE_COIN_REWARD
    this.checkCoinBonusLife()
    this.pushFlash(this.hole.x, this.hole.y, `+${gained}`)
    this.triggerShake()
    this.dockBall()
    this.launchBall()
  }

  /**
   * Flipper 擺動極快（單一 tick 可轉超過半個行程，tip 瞬間位移可達數十 px），
   * 若碰撞判定只看這個 tick「轉完之後」的最終角度，球有機會剛好卡在「轉動前」與「轉動後」
   * 兩個離散角度都碰不到的掃過範圍內，直接穿越 Flipper（見實測：轉動瞬間球直接穿越漏球）。
   * 因此角度也要跟著球的 substep 一起內插，逐步碰撞判定，而非只判定最終角度。
   */
  private moveBallWithFlipperCollisions(leftAngleBefore: number, rightAngleBefore: number) {
    const speed = Math.hypot(this.ball.vx, this.ball.vy)
    const maxStep = (BALL_RADIUS + FLIPPER_COLLISION_RADIUS) * 0.55
    const substeps = Math.max(1, Math.ceil(speed / maxStep))
    const stepVx = this.ball.vx / substeps
    const stepVy = this.ball.vy / substeps
    const leftAngleAfter = this.leftFlipper.angle
    const rightAngleAfter = this.rightFlipper.angle

    for (let step = 0; step < substeps; step++) {
      this.ball.x += stepVx
      this.ball.y += stepVy
      const t = (step + 1) / substeps
      this.leftFlipper.angle = leftAngleBefore + (leftAngleAfter - leftAngleBefore) * t
      this.rightFlipper.angle = rightAngleBefore + (rightAngleAfter - rightAngleBefore) * t
      this.resolveWalls()
      this.resolveSideWellWalls()
      this.resolveLaunchLaneDivider()
      this.resolveFlipperPivotCollision(this.leftFlipper)
      this.resolveFlipperCollision(this.leftFlipper)
      // 發球道與右 Flipper 機構在實體桌面上是分開的通道，剛發球、球還沒離開發球道時不應碰到右 Flipper／軸心，
      // 否則新發球會直接撞上緊貼隔板的 Flipper 軸心被打偏（見實測：發球瞬間直接漏球）。
      // 只在「剛發球」這段期間排除，球一離開發球道就恆久解除，避免球後續正常飛回右側時穿過 Flipper 直接漏球
      if (this.rightLaneLaunchGuard && this.ball.x + BALL_RADIUS > LAUNCH_LANE_DIVIDER_X) {
        // still inside the launch lane right after launch, skip right flipper collision this substep
      } else {
        this.rightLaneLaunchGuard = false
        this.resolveFlipperPivotCollision(this.rightFlipper)
        this.resolveFlipperCollision(this.rightFlipper)
      }
      this.resolveCenterPost()
    }
    this.leftFlipper.angle = leftAngleAfter
    this.rightFlipper.angle = rightAngleAfter
    this.resolveFlipperWellAntiStuck()
  }

  private loseBall() {
    this.lives -= 1
    this.combo = 0
    this.comboMsLeft = 0
    this.dockBall()
    if (this.lives <= 0) {
      this.finalLeftoverCoinCount = Math.max(0, this.coinsCollected - this.coinBonusLivesGranted * COIN_PER_EXTRA_BALL)
      this.finalCoinBonusAmount = this.finalLeftoverCoinCount * COIN_LEFTOVER_SCORE_BONUS
      this.score += this.finalCoinBonusAmount
      this.status = 'gameover'
      return
    }
    this.ballIndex += 1
    const shuffled = [...UPGRADE_POOL].sort(() => Math.random() - 0.5)
    this.pendingUpgradeChoices = shuffled.slice(0, 3)
    this.status = 'upgrade'
  }

  tick(dtMs: number) {
    if (this.status !== 'playing') return
    const dt = dtMs / 16
    const ticks = Math.max(1, Math.round(dt))

    for (let i = 0; i < ticks; i++) {
      const leftAngleBefore = this.leftFlipper.angle
      const rightAngleBefore = this.rightFlipper.angle
      this.updateFlipper(this.leftFlipper, 1)
      this.updateFlipper(this.rightFlipper, 1)

      if (this.ball.active) {
        this.ball.vy += GRAVITY
        this.ball.vx *= AIR_FRICTION
        this.ball.vy *= AIR_FRICTION
        clampSpeed(this.ball)
        this.moveBallWithFlipperCollisions(leftAngleBefore, rightAngleBefore)
        this.resolveBumpers()
        this.resolveTargets()
        this.resolveHole()

        if (this.ball.y - BALL_RADIUS > PINBALL_HEIGHT) {
          this.loseBall()
          break
        }
      }

      if (this.comboMsLeft > 0) {
        this.comboMsLeft -= 16
        if (this.comboMsLeft <= 0) {
          this.comboMsLeft = 0
          this.combo = 0
        }
      }

      if (this.feverActive) {
        this.feverMsLeft -= 16
        if (this.feverMsLeft <= 0) this.endFever()
      }
    }

    this.hitFlashes = this.hitFlashes
      .map((f) => ({ ...f, msLeft: f.msLeft - dtMs }))
      .filter((f) => f.msLeft > 0)
    this.bumpers.forEach((b) => { if (b.flashMsLeft > 0) b.flashMsLeft = Math.max(0, b.flashMsLeft - dtMs) })
    this.targets.forEach((t) => { if (t.flashMsLeft > 0) t.flashMsLeft = Math.max(0, t.flashMsLeft - dtMs) })
    if (this.hole.flashMsLeft > 0) this.hole.flashMsLeft = Math.max(0, this.hole.flashMsLeft - dtMs)
    if (this.centerPost.flashMsLeft > 0) this.centerPost.flashMsLeft = Math.max(0, this.centerPost.flashMsLeft - dtMs)
  }

  getSnapshot(): PinballSnapshot {
    return {
      status: this.status,
      ball: { ...this.ball },
      leftFlipper: { ...this.leftFlipper },
      rightFlipper: { ...this.rightFlipper },
      bumpers: this.bumpers.map((b) => ({ ...b })),
      targets: this.targets.map((t) => ({ ...t })),
      hole: { ...this.hole },
      centerPost: { ...this.centerPost },
      score: this.score,
      lives: this.lives,
      ballIndex: this.ballIndex,
      combo: this.combo,
      maxCombo: this.maxCombo,
      comboMultiplier: this.comboMultiplier(),
      comboMsLeft: this.comboMsLeft,
      feverActive: this.feverActive,
      feverMsLeft: this.feverMsLeft,
      feverCount: this.feverCount,
      coinsCollected: this.coinsCollected,
      coinBonusLivesGranted: this.coinBonusLivesGranted,
      finalCoinBonusAmount: this.finalCoinBonusAmount,
      finalLeftoverCoinCount: this.finalLeftoverCoinCount,
      pendingUpgradeChoices: this.pendingUpgradeChoices,
      hitFlashes: this.hitFlashes.map((f) => ({ id: f.id, x: f.x, y: f.y, text: f.text })),
      shakeToken: this.shakeToken,
      ballDocked: this.ballDocked
    }
  }
}
