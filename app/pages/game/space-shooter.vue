<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'

type ShooterStatus = 'ready' | 'playing' | 'pause' | 'gameover'
type EnemyType = 'basic' | 'tough' | 'milestone'
type PowerupType = 'shield' | 'rapid' | 'spread'
type Vec = { id: number; x: number; y: number }
type Bullet = Vec & { vx: number }
type Enemy = Vec & { type: EnemyType; hp: number; vx: number; phase: number; fireTicks: number }
type Powerup = Vec & { type: PowerupType }
type Star = { id: number; x: number; y: number; size: number; speed: number }
type Explosion = { id: number; x: number; y: number }
type StepResult = { gameOver: boolean; hitTaken: boolean }

const STAGE_WIDTH = 400
const STAGE_HEIGHT = 460
const PLAYER_WIDTH = 30
const PLAYER_HEIGHT = 22
const PLAYER_Y = STAGE_HEIGHT - 46
const PLAYER_SPEED = 5
const PLAYER_HITBOX_SHRINK = 6

const BULLET_WIDTH = 4
const BULLET_HEIGHT = 12
const PLAYER_BULLET_SPEED = 8
const FIRE_COOLDOWN_TICKS = 10
const RAPID_FIRE_COOLDOWN_TICKS = 5
const SPREAD_VX = 1.6

const ENEMY_BULLET_SPEED = 2.6

const ENEMY_STATS: Record<Exclude<EnemyType, 'milestone'>, { width: number; height: number; hp: number; score: number; speed: number; dropChance: number }> = {
  /* 使用者明確指定基本/強化/里程碑分數比例為 1:3:5，比先前的估算值再大幅調降；
     MILESTONE_SCORE_STEP／LEVEL_SCORE_THRESHOLDS 同步等比例調降，維持原本「多久見到里程碑／多久升 Lv」
     所需的擊殺數節奏不變（比照擊殺數反推分數門檻，而非直接線性縮放舊門檻） */
  basic: { width: 24, height: 20, hp: 1, score: 1, speed: 1.4, dropChance: 0.06 },
  tough: { width: 30, height: 26, hp: 3, score: 3, speed: 1.1, dropChance: 0.15 }
}
const MILESTONE_STATS = { width: 44, height: 34, hp: 10, score: 5, speed: 1.4 }
const MILESTONE_SCORE_STEP = 50

const LIVES_START = 3
const INVULN_TICKS = 94
const TICK_MS = 16
const READY_START = 3

const COMBO_THRESHOLDS = [0, 5, 12, 24]
const COMBO_MULTIPLIERS = [1, 2, 3, 4]
const LEVEL_SCORE_THRESHOLDS = [0, 25, 60, 120, 200]
const BASE_SPAWN_TICKS = 60
const SPAWN_TICKS_PER_LEVEL = 6
const MIN_SPAWN_TICKS = 26
const TOUGH_CHANCE_BASE = 0.2
const TOUGH_CHANCE_PER_LEVEL = 0.08

const POWERUP_DURATION_TICKS = 500
const POWERUP_FALL_SPEED = 1.2
const POWERUP_SIZE = 20

const calcLevel = (score: number) => {
  let level = 1
  for (let i = LEVEL_SCORE_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (score >= LEVEL_SCORE_THRESHOLDS[i]!) {
      level = i + 1
      break
    }
  }
  return level
}

const calcMultiplier = (combo: number) => {
  let multiplier = COMBO_MULTIPLIERS[0]!
  for (let i = COMBO_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (combo >= COMBO_THRESHOLDS[i]!) {
      multiplier = COMBO_MULTIPLIERS[i]!
      break
    }
  }
  return multiplier
}

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/**
 * 俯視角射擊的核心邏輯：玩家水平移動＋射擊，敵機／敵彈／道具持續生成與回收，
 * 雙向拋射物碰撞（玩家子彈 vs 敵機、敵彈／敵機本體 vs 玩家）各自獨立判定。
 * 只有這一款遊戲用到，不抽到 app/utils/（見 openspec/changes/add-space-shooter-game/design.md）。
 */
class SpaceShooterEngine {
  playerX = STAGE_WIDTH / 2 - PLAYER_WIDTH / 2
  playerBullets: Bullet[] = []
  enemies: Enemy[] = []
  enemyBullets: Bullet[] = []
  powerups: Powerup[] = []
  stars: Star[] = []
  score = 0
  level = 1
  combo = 0
  multiplier = 1
  lives = LIVES_START
  invulnTicks = 0
  shield = false
  weaponBuff: { type: 'rapid' | 'spread'; ticksLeft: number } | null = null
  private fireCooldown = 0
  private spawnCountdown = BASE_SPAWN_TICKS
  private nextMilestoneScore = MILESTONE_SCORE_STEP
  private nextId = 1

  constructor() {
    this.stars = Array.from({ length: 40 }, () => this.spawnStar(true))
  }

  reset() {
    this.playerX = STAGE_WIDTH / 2 - PLAYER_WIDTH / 2
    this.playerBullets = []
    this.enemies = []
    this.enemyBullets = []
    this.powerups = []
    this.score = 0
    this.level = 1
    this.combo = 0
    this.multiplier = 1
    this.lives = LIVES_START
    this.invulnTicks = 0
    this.shield = false
    this.weaponBuff = null
    this.fireCooldown = 0
    this.spawnCountdown = BASE_SPAWN_TICKS
    this.nextMilestoneScore = MILESTONE_SCORE_STEP
  }

  private spawnStar(initial: boolean): Star {
    const layer = Math.random()
    return {
      id: this.nextId++,
      x: Math.random() * STAGE_WIDTH,
      y: initial ? Math.random() * STAGE_HEIGHT : -4,
      size: layer < 0.6 ? 1 : layer < 0.9 ? 2 : 3,
      speed: layer < 0.6 ? 0.4 : layer < 0.9 ? 0.8 : 1.4
    }
  }

  private spawnEnemy() {
    const isTough = Math.random() < Math.min(0.6, TOUGH_CHANCE_BASE + (this.level - 1) * TOUGH_CHANCE_PER_LEVEL)
    const type: Exclude<EnemyType, 'milestone'> = isTough ? 'tough' : 'basic'
    const stats = ENEMY_STATS[type]
    this.enemies.push({
      id: this.nextId++,
      type,
      x: Math.random() * (STAGE_WIDTH - stats.width),
      y: -stats.height,
      hp: stats.hp,
      vx: 0,
      phase: Math.random() * Math.PI * 2,
      fireTicks: 60 + Math.floor(Math.random() * 60)
    })
  }

  private spawnMilestoneEnemy() {
    this.enemies.push({
      id: this.nextId++,
      type: 'milestone',
      x: STAGE_WIDTH / 2 - MILESTONE_STATS.width / 2,
      y: -MILESTONE_STATS.height,
      hp: MILESTONE_STATS.hp,
      vx: 1.6,
      phase: 0,
      fireTicks: 50
    })
  }

  private spawnPowerup(x: number, y: number) {
    const types: PowerupType[] = ['shield', 'rapid', 'spread']
    const type = types[Math.floor(Math.random() * types.length)]!
    this.powerups.push({ id: this.nextId++, type, x, y })
  }

  private fire() {
    const isSpread = this.weaponBuff?.type === 'spread'
    const y = PLAYER_Y - BULLET_HEIGHT
    const centerX = this.playerX + PLAYER_WIDTH / 2 - BULLET_WIDTH / 2
    if (isSpread) {
      this.playerBullets.push({ id: this.nextId++, x: centerX, y, vx: 0 })
      this.playerBullets.push({ id: this.nextId++, x: centerX, y, vx: -SPREAD_VX })
      this.playerBullets.push({ id: this.nextId++, x: centerX, y, vx: SPREAD_VX })
    } else {
      this.playerBullets.push({ id: this.nextId++, x: centerX, y, vx: 0 })
    }
    this.fireCooldown = this.weaponBuff?.type === 'rapid' ? RAPID_FIRE_COOLDOWN_TICKS : FIRE_COOLDOWN_TICKS
  }

  private applyPowerup(type: PowerupType) {
    if (type === 'shield') {
      this.shield = true
      return
    }
    this.weaponBuff = { type, ticksLeft: POWERUP_DURATION_TICKS }
  }

  private takeDamage(): boolean {
    if (this.invulnTicks > 0) return false
    if (this.shield) {
      this.shield = false
      return false
    }
    this.lives -= 1
    this.combo = 0
    this.multiplier = 1
    this.invulnTicks = INVULN_TICKS
    this.playerX = STAGE_WIDTH / 2 - PLAYER_WIDTH / 2
    return true
  }

  private registerKill(enemy: Enemy, explosions: Array<{ x: number; y: number }>) {
    const stats = enemy.type === 'milestone' ? MILESTONE_STATS : ENEMY_STATS[enemy.type]
    this.combo += 1
    this.multiplier = calcMultiplier(this.combo)
    this.score += stats.score * this.multiplier
    explosions.push({ x: enemy.x + stats.width / 2, y: enemy.y + stats.height / 2 })
    const dropChance = enemy.type === 'milestone' ? 1 : ENEMY_STATS[enemy.type].dropChance
    if (Math.random() < dropChance) {
      this.spawnPowerup(enemy.x + stats.width / 2 - POWERUP_SIZE / 2, enemy.y)
    }
  }

  step(moveDir: -1 | 0 | 1, firing: boolean): StepResult & { explosions: Array<{ x: number; y: number }> } {
    const explosions: Array<{ x: number; y: number }> = []
    let hitTaken = false

    // 玩家移動與射擊
    this.playerX = Math.max(0, Math.min(STAGE_WIDTH - PLAYER_WIDTH, this.playerX + moveDir * PLAYER_SPEED))
    if (this.fireCooldown > 0) this.fireCooldown -= 1
    if (firing && this.fireCooldown <= 0) this.fire()
    if (this.invulnTicks > 0) this.invulnTicks -= 1
    if (this.weaponBuff) {
      this.weaponBuff.ticksLeft -= 1
      if (this.weaponBuff.ticksLeft <= 0) this.weaponBuff = null
    }

    // 星空視差
    this.stars.forEach((star) => {
      star.y += star.speed
    })
    this.stars = this.stars.filter((star) => star.y < STAGE_HEIGHT + 4)
    while (this.stars.length < 40) this.stars.push(this.spawnStar(false))

    // 拋射物與敵機位置更新
    this.playerBullets.forEach((b) => {
      b.y -= PLAYER_BULLET_SPEED
      b.x += b.vx
    })
    this.playerBullets = this.playerBullets.filter((b) => b.y + BULLET_HEIGHT > 0)

    this.enemies.forEach((enemy) => {
      if (enemy.type === 'milestone') {
        enemy.y += MILESTONE_STATS.speed * 0.4
        enemy.x += enemy.vx
        if (enemy.x <= 0 || enemy.x + MILESTONE_STATS.width >= STAGE_WIDTH) enemy.vx *= -1
        enemy.fireTicks -= 1
        if (enemy.fireTicks <= 0) {
          enemy.fireTicks = 60
          this.enemyBullets.push({ id: this.nextId++, x: enemy.x + MILESTONE_STATS.width / 2 - BULLET_WIDTH / 2, y: enemy.y + MILESTONE_STATS.height, vx: 0 })
        }
        return
      }
      const stats = ENEMY_STATS[enemy.type]
      enemy.y += stats.speed
      enemy.phase += 0.05
      enemy.x += Math.sin(enemy.phase) * 0.8
      if (enemy.type === 'tough') {
        enemy.fireTicks -= 1
        if (enemy.fireTicks <= 0) {
          enemy.fireTicks = 90 + Math.floor(Math.random() * 60)
          this.enemyBullets.push({ id: this.nextId++, x: enemy.x + stats.width / 2 - BULLET_WIDTH / 2, y: enemy.y + stats.height, vx: 0 })
        }
      }
    })
    this.enemies = this.enemies.filter((e) => e.y < STAGE_HEIGHT + 60)

    this.enemyBullets.forEach((b) => {
      b.y += ENEMY_BULLET_SPEED
    })
    this.enemyBullets = this.enemyBullets.filter((b) => b.y < STAGE_HEIGHT + BULLET_HEIGHT)

    this.powerups.forEach((p) => {
      p.y += POWERUP_FALL_SPEED
    })
    this.powerups = this.powerups.filter((p) => p.y < STAGE_HEIGHT + POWERUP_SIZE)

    // 生成新敵機
    this.spawnCountdown -= 1
    if (this.spawnCountdown <= 0) {
      this.spawnEnemy()
      this.spawnCountdown = Math.max(MIN_SPAWN_TICKS, BASE_SPAWN_TICKS - (this.level - 1) * SPAWN_TICKS_PER_LEVEL)
    }
    if (this.score >= this.nextMilestoneScore) {
      this.spawnMilestoneEnemy()
      this.nextMilestoneScore += MILESTONE_SCORE_STEP
    }

    // 玩家子彈 vs 敵機
    this.playerBullets.forEach((bullet) => {
      const bulletBox = { x: bullet.x, y: bullet.y, w: BULLET_WIDTH, h: BULLET_HEIGHT }
      this.enemies.forEach((enemy) => {
        if (bullet.y < 0) return
        const stats = enemy.type === 'milestone' ? MILESTONE_STATS : ENEMY_STATS[enemy.type]
        const enemyBox = { x: enemy.x, y: enemy.y, w: stats.width, h: stats.height }
        if (overlaps(bulletBox, enemyBox)) {
          enemy.hp -= 1
          bullet.y = -9999
        }
      })
    })
    this.playerBullets = this.playerBullets.filter((b) => b.y > -999)
    const dead = this.enemies.filter((e) => e.hp <= 0)
    dead.forEach((enemy) => this.registerKill(enemy, explosions))
    this.enemies = this.enemies.filter((e) => e.hp > 0)

    // 敵彈／敵機本體 vs 玩家
    const playerBox = {
      x: this.playerX + PLAYER_HITBOX_SHRINK,
      y: PLAYER_Y + PLAYER_HITBOX_SHRINK,
      w: PLAYER_WIDTH - PLAYER_HITBOX_SHRINK * 2,
      h: PLAYER_HEIGHT - PLAYER_HITBOX_SHRINK * 2
    }
    if (this.invulnTicks <= 0) {
      const hitByBullet = this.enemyBullets.find((b) => overlaps({ x: b.x, y: b.y, w: BULLET_WIDTH, h: BULLET_HEIGHT }, playerBox))
      if (hitByBullet) {
        hitByBullet.y = STAGE_HEIGHT + 999
        if (this.takeDamage()) hitTaken = true
      }
      const hitByEnemy = this.enemies.find((enemy) => {
        const stats = enemy.type === 'milestone' ? MILESTONE_STATS : ENEMY_STATS[enemy.type]
        return overlaps({ x: enemy.x, y: enemy.y, w: stats.width, h: stats.height }, playerBox)
      })
      if (hitByEnemy) {
        hitByEnemy.hp = 0
        if (this.takeDamage()) hitTaken = true
      }
    }
    this.enemyBullets = this.enemyBullets.filter((b) => b.y < STAGE_HEIGHT + 900)
    this.enemies = this.enemies.filter((e) => e.hp > 0)

    // 玩家 vs 道具
    const collected = this.powerups.filter((p) => overlaps({ x: p.x, y: p.y, w: POWERUP_SIZE, h: POWERUP_SIZE }, playerBox))
    collected.forEach((p) => this.applyPowerup(p.type))
    if (collected.length) {
      const collectedIds = new Set(collected.map((p) => p.id))
      this.powerups = this.powerups.filter((p) => !collectedIds.has(p.id))
    }

    this.level = calcLevel(this.score)

    return { gameOver: this.lives <= 0, hitTaken, explosions }
  }

  getSnapshot() {
    return {
      playerX: this.playerX,
      playerBullets: this.playerBullets.map((b) => ({ ...b })),
      enemies: this.enemies.map((e) => ({ ...e })),
      enemyBullets: this.enemyBullets.map((b) => ({ ...b })),
      powerups: this.powerups.map((p) => ({ ...p })),
      stars: this.stars.map((s) => ({ ...s })),
      score: this.score,
      level: this.level,
      combo: this.combo,
      multiplier: this.multiplier,
      lives: this.lives,
      invulnTicks: this.invulnTicks,
      shield: this.shield,
      weaponBuff: this.weaponBuff ? { ...this.weaponBuff } : null
    }
  }
}

const router = useRouter()
const engine = new SpaceShooterEngine()
const gameHistory = useGameHistory()

const state = reactive({
  status: 'ready' as ShooterStatus,
  playerX: engine.playerX,
  playerBullets: [] as Bullet[],
  enemies: [] as Enemy[],
  enemyBullets: [] as Bullet[],
  powerups: [] as Powerup[],
  stars: [] as Star[],
  explosions: [] as Explosion[],
  score: 0,
  level: 1,
  combo: 0,
  multiplier: 1,
  lives: LIVES_START,
  invulnTicks: 0,
  shield: false,
  weaponBuff: null as { type: 'rapid' | 'spread'; ticksLeft: number } | null,
  stageShake: false,
  message: '按「開始」後用 ←/→ 或 A/D 移動，按住空白鍵發射。',
  rewardMessage: '',
  waitingOverlayVisible: true,
  readyOverlayVisible: false,
  readyCountdownValue: READY_START,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const SPACE_SHOOTER_RULE = {
  description:
    '←/→ 或 A/D 移動飛船，按住空白鍵／Enter 連續射擊；基本敵機低血量低分，強化敵機高血量高分且會開火，' +
    '分數每滿 50 分額外出現一隻左右橫掃的強敵。共有 3 條命，被擊中扣 1 命並短暫無敵；連續擊殺會提升分數倍率，被擊中則歸零。' +
    '敵機掉落道具：護盾可抵銷一次傷害、加速射擊／散射彈為限時武器強化。',
  scoreRule: 'SCORE ＝ 擊落敵機基礎分數（基本 1／強化 3／里程碑強敵 5）× 當下連擊倍率（x1～x4），開放式無上限。',
  levels: LEVEL_SCORE_THRESHOLDS.map((threshold, idx) => ({
    level: idx + 1,
    condition: idx + 1 < LEVEL_SCORE_THRESHOLDS.length ? `${threshold}–${LEVEL_SCORE_THRESHOLDS[idx + 1]! - 1} 分` : `${threshold} 分以上`
  })),
  note: '等級越高，敵機生成越密集、強化敵機比例越高。'
}

let tickTimer: ReturnType<typeof setInterval> | null = null
let readyTimer: ReturnType<typeof setInterval> | null = null
let shakeTimer: ReturnType<typeof setTimeout> | null = null
let explosionCleanupId = 1
let moveLeftHeld = false
let moveRightHeld = false
let fireHeld = false

const statusText = computed(() => {
  if (state.status === 'playing') return 'PLAYING'
  if (state.status === 'pause') return 'PAUSE'
  if (state.status === 'gameover') return 'GAME OVER'
  return 'READY'
})
const statusClass = computed(() => {
  if (state.status === 'playing') return 'is-playing'
  if (state.status === 'pause') return 'is-pause'
  if (state.status === 'gameover') return 'is-gameover'
  return 'is-ready'
})
const canResumeFromPause = computed(
  () => state.status === 'pause' && !state.waitingOverlayVisible && !state.readyOverlayVisible && !state.resultOverlayVisible
)
const canPauseWhilePlaying = computed(() => state.status === 'playing')
const isInvulnBlinking = computed(() => state.invulnTicks > 0 && Math.floor(state.invulnTicks / 6) % 2 === 0)

/** 私有工具方法：計時器管理、狀態同步 */
const _handlers = {
  syncState: (explosions?: Array<{ x: number; y: number }>) => {
    const snap = engine.getSnapshot()
    state.playerX = snap.playerX
    state.playerBullets = snap.playerBullets
    state.enemies = snap.enemies
    state.enemyBullets = snap.enemyBullets
    state.powerups = snap.powerups
    state.stars = snap.stars
    state.score = snap.score
    state.level = snap.level
    state.combo = snap.combo
    state.multiplier = snap.multiplier
    state.lives = snap.lives
    state.invulnTicks = snap.invulnTicks
    state.shield = snap.shield
    state.weaponBuff = snap.weaponBuff
    if (explosions?.length) {
      explosions.forEach((pos) => {
        const id = explosionCleanupId++
        state.explosions.push({ id, x: pos.x, y: pos.y })
        setTimeout(() => {
          state.explosions = state.explosions.filter((e) => e.id !== id)
        }, 400)
      })
    }
  },
  stopTickTimer: () => {
    if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  },
  stopReadyTimer: () => {
    if (readyTimer) {
      clearInterval(readyTimer)
      readyTimer = null
    }
  },
  stopShakeTimer: () => {
    if (shakeTimer) {
      clearTimeout(shakeTimer)
      shakeTimer = null
    }
  },
  triggerShake: () => {
    _handlers.stopShakeTimer()
    state.stageShake = true
    shakeTimer = setTimeout(() => {
      state.stageShake = false
      shakeTimer = null
    }, 260)
  },
  runReadyCountdown: (onDone: () => void) => {
    _handlers.stopReadyTimer()
    state.readyOverlayVisible = true
    state.readyCountdownValue = READY_START
    readyTimer = setInterval(() => {
      if (state.readyCountdownValue <= 1) {
        _handlers.stopReadyTimer()
        state.readyOverlayVisible = false
        onDone()
        return
      }
      state.readyCountdownValue -= 1
    }, 700)
  },
  currentMoveDir: (): -1 | 0 | 1 => {
    if (moveLeftHeld && !moveRightHeld) return -1
    if (moveRightHeld && !moveLeftHeld) return 1
    return 0
  },
  powerupLabel: (type: PowerupType) => (type === 'shield' ? '🛡' : type === 'rapid' ? '⚡' : '✳'),
  enemyClass: (enemy: Enemy) => `ss-enemy ${enemy.type}`
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('spaceShooter', 'SPACE SHOOTER', {
        score: state.score,
        level: state.level
      })
      if (result.coinReward > 0) {
        state.rewardMessage = result.coinCapped ? `+${result.coinReward} coin（已達今日上限）` : `+${result.coinReward} coin`
      }
    } catch {
      // 紀錄寫入失敗不影響遊戲本身，靜默略過
    }
  },
  finishGame: () => {
    state.status = 'gameover'
    state.message = '生命值歸零，遊戲結束。'
    state.resultOverlayVisible = true
    _handlers.stopTickTimer()
    _actions.recordHistory()
  },
  startTickLoop: () => {
    _handlers.stopTickTimer()
    tickTimer = setInterval(() => {
      if (state.status !== 'playing') return
      const result = engine.step(_handlers.currentMoveDir(), fireHeld)
      _handlers.syncState(result.explosions)
      if (result.hitTaken) _handlers.triggerShake()
      if (result.gameOver) {
        _actions.finishGame()
      }
    }, TICK_MS)
  },
  resetGame: () => {
    _handlers.stopTickTimer()
    _handlers.stopReadyTimer()
    _handlers.stopShakeTimer()
    engine.reset()
    _handlers.syncState()
    state.status = 'ready'
    state.explosions = []
    state.stageShake = false
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.readyOverlayVisible = false
    state.rewardMessage = ''
    state.message = '按「開始」後用 ←/→ 或 A/D 移動，按住空白鍵發射。'
  },
  startGame: () => {
    if (state.status === 'playing' || state.readyOverlayVisible) return
    if (state.status === 'gameover') _actions.resetGame()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    _handlers.runReadyCountdown(() => {
      state.status = 'playing'
      state.message = '戰鬥中...'
      _actions.startTickLoop()
    })
  },
  pauseGame: () => {
    if (state.status !== 'playing') return
    state.status = 'pause'
    state.message = '已暫停'
    _handlers.stopTickTimer()
  },
  resumeGame: () => {
    if (!canResumeFromPause.value) return
    state.status = 'playing'
    state.message = '戰鬥中...'
    _actions.startTickLoop()
  },
  playAgain: () => {
    _actions.resetGame()
    _actions.startGame()
  },
  endGameNow: () => {
    _handlers.stopTickTimer()
    _handlers.stopReadyTimer()
    state.waitingOverlayVisible = false
    state.readyOverlayVisible = false
    state.status = 'gameover'
    state.message = '本局已結束。'
    state.resultOverlayVisible = true
    _actions.recordHistory()
  }
}

const onShooterKeydown = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase()
  if (key === 'arrowleft' || key === 'a') {
    moveLeftHeld = true
    event.preventDefault()
  }
  if (key === 'arrowright' || key === 'd') {
    moveRightHeld = true
    event.preventDefault()
  }
  if (key === ' ' || key === 'enter') {
    fireHeld = true
    event.preventDefault()
  }
}
const onShooterKeyup = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase()
  if (key === 'arrowleft' || key === 'a') moveLeftHeld = false
  if (key === 'arrowright' || key === 'd') moveRightHeld = false
  if (key === ' ' || key === 'enter') fireHeld = false
}

const click = {
  start: () => _actions.startGame(),
  pause: () => _actions.pauseGame(),
  resume: () => _actions.resumeGame(),
  replay: () => _actions.resetGame(),
  end: () => _actions.endGameNow(),
  again: () => _actions.playAgain(),
  exit: () => router.replace('/game-hall'),
  openRateDialog: () => {
    state.rateDialogOpen = true
  },
  closeRateDialog: () => {
    state.rateDialogOpen = false
  },
  openRuleDialog: () => {
    state.ruleDialogOpen = true
  },
  closeRuleDialog: () => {
    state.ruleDialogOpen = false
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onShooterKeydown)
    window.addEventListener('keyup', onShooterKeyup)
  }
  _actions.resetGame()
  state.waitingOverlayVisible = true
})

onBeforeUnmount(() => {
  _handlers.stopTickTimer()
  _handlers.stopReadyTimer()
  _handlers.stopShakeTimer()
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onShooterKeydown)
    window.removeEventListener('keyup', onShooterKeyup)
  }
})
</script>

<template>
  <main class="ss-page" :class="`state-${state.status}`">
    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">SPACE SHOOTER</p>
      <button class="ss-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="ss-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="ss-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>
    <div v-if="state.readyOverlayVisible" class="game-mask ready-mask">
      <div class="mask-title">READY</div>
      <div class="mask-count">{{ state.readyCountdownValue }}</div>
    </div>
    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">RESULT</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>LEVEL</span><b>{{ state.level }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="ss-btn" type="button" @click="click.again">AGAIN</button>
        <button class="ss-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="spaceShooter" game-name="SPACE SHOOTER"
      accent-color="#4d7fff" @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="SPACE SHOOTER" accent-color="#4d7fff"
      v-bind="SPACE_SHOOTER_RULE" @close="click.closeRuleDialog" />

    <section class="ss-shell">
      <aside class="ss-side left">
        <button class="ss-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="ss-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="ss-btn" type="button" @click="click.replay">REPLAY</button>
        <button class="ss-btn link" type="button" @click="click.end">END</button>
        <button class="ss-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="ss-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="ss-center">
        <header class="ss-title-wrap">
          <h1 class="ss-title">SPACE SHOOTER</h1>
          <p class="ss-status" :class="statusClass">{{ statusText }}</p>
        </header>

        <div class="ss-frame">
          <div class="ss-stage" :class="{ shake: state.stageShake }">
            <i v-for="star in state.stars" :key="star.id" class="ss-star"
              :style="`left:${star.x}px; top:${star.y}px; width:${star.size}px; height:${star.size}px;`" />

            <div v-for="p in state.powerups" :key="p.id" class="ss-powerup"
              :style="`left:${p.x}px; top:${p.y}px;`">{{ _handlers.powerupLabel(p.type) }}</div>

            <div v-for="e in state.enemies" :key="e.id" :class="_handlers.enemyClass(e)"
              :style="`left:${e.x}px; top:${e.y}px;`" />

            <div v-for="b in state.enemyBullets" :key="b.id" class="ss-bullet enemy"
              :style="`left:${b.x}px; top:${b.y}px;`" />
            <div v-for="b in state.playerBullets" :key="b.id" class="ss-bullet player"
              :style="`left:${b.x}px; top:${b.y}px;`" />

            <div v-for="ex in state.explosions" :key="ex.id" class="ss-explosion"
              :style="`left:${ex.x}px; top:${ex.y}px;`" />

            <div class="ss-player" :class="{ blink: isInvulnBlinking, shielded: state.shield }"
              :style="`left:${state.playerX}px; top:${PLAYER_Y}px;`" />
          </div>
          <div class="ss-panel">
            <span>SCORE: {{ state.score }}</span>
            <span>LV: {{ state.level }}</span>
            <span>LIVES: {{ '❤'.repeat(Math.max(0, state.lives)) }}</span>
          </div>
          <div class="ss-panel sub">
            <span>COMBO x{{ state.multiplier }} ({{ state.combo }})</span>
            <span v-if="state.weaponBuff">{{ state.weaponBuff.type === 'rapid' ? '加速射擊' : '散射彈' }} {{ Math.ceil(state.weaponBuff.ticksLeft * 16 / 1000) }}s</span>
            <span v-if="state.shield">護盾中</span>
          </div>
        </div>

        <p class="ss-message">{{ state.message }}</p>
      </section>

      <aside class="ss-side right">
        <div class="ss-help-panel">
          <p class="ss-help-title">HOW TO PLAY</p>
          <p class="ss-help-text">←/→ 或 A/D 移動，按住空白鍵連射；擊落敵機得分，連續擊殺提升倍率；3 條命，被擊中短暫無敵；撿道具可獲得護盾或武器強化。</p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.ss-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #060a1e, #010104 60%);
  overflow: hidden;
  isolation: isolate;

  .game-mask {
    position: absolute;
    inset: 0;
    z-index: 4;
    background: rgba(0, 0, 0, 0.78);
    display: grid;
    place-items: center;
    align-content: center;
    gap: 12px;

    .mask-title {
      color: #4d7fff;
      font-size: clamp(2rem, 8vw, 4rem);
      letter-spacing: 0.25rem;
      font-weight: 900;
    }

    .mask-count {
      color: #4d7fff;
      font-size: clamp(3rem, 12vw, 7rem);
      font-weight: 900;
      line-height: 1;
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #a9c1ff;
        letter-spacing: 0.3rem;
        font-size: 0.95rem;
      }

      .waiting-btn {
        width: 160px;
      }
    }

    &.result-mask {
      .result-list {
        display: grid;
        gap: 8px;
        width: 260px;
      }

      .result-item {
        display: flex;
        justify-content: space-between;
        border: 1px solid rgba(77, 127, 255, 0.4);
        background: rgba(10, 16, 40, 0.65);
        color: #c7d6ff;
        padding: 8px 10px;
      }

      .result-reward {
        margin: 8px 0 0;
        color: #ffe066;
        font-size: 0.85rem;
        text-align: center;
        letter-spacing: 0.05em;
      }

      .result-actions {
        margin-top: 8px;
        display: flex;
        gap: 10px;
      }
    }
  }

  .ss-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: center;
  }

  .ss-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .ss-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(77, 127, 255, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(8, 14, 34, 0.75);
    color: #4d7fff;
    font-weight: 700;
    letter-spacing: 0.5px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(190, 210, 255, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover {
      border-color: #4d7fff;
      box-shadow: 0 0 12px rgba(77, 127, 255, 0.35);
      transform: translateY(-1px);

      &::after {
        transform: translateX(150%);
      }
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      box-shadow: none;
    }

    &.link {
      text-align: center;
      text-decoration: none;
    }

    &.danger {
      border-color: rgba(255, 60, 60, 0.5);
      color: #ff7d7d;
    }
  }

  .ss-center {
    text-align: center;

    .ss-title-wrap {
      margin-bottom: 8px;
    }

    .ss-title {
      margin: 0;
      color: #4d7fff;
      font-size: clamp(1.5rem, 4.4vw, 2.6rem);
      letter-spacing: 0.1rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(77, 127, 255, 0.5);
      animation: title-float 2.6s ease-in-out infinite;
    }

    .ss-status {
      margin: 2px 0 0;
      color: #c7d6ff;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;

      &.is-playing {
        color: #4d7fff;
      }

      &.is-pause {
        color: #ffcc33;
      }

      &.is-gameover {
        color: #ff5e5e;
      }
    }

    .ss-frame {
      width: fit-content;
      margin: 12px auto 0;
      padding: 12px;
      background: #060a1e;
      border: 10px solid #131c40;
      border-radius: 18px;
      box-shadow: 0 0 0 1px rgba(77, 127, 255, 0.2), 0 0 24px rgba(77, 127, 255, 0.16);
      animation: frame-glow 5.4s ease-in-out infinite;
    }

    .ss-stage {
      box-sizing: content-box;
      position: relative;
      width: 400px;
      height: 460px;
      background: #01020a;
      border: 2px solid #000;
      border-radius: 8px;
      overflow: hidden;

      &.shake {
        animation: stage-shake 260ms ease-out;
      }

      .ss-star {
        position: absolute;
        border-radius: 50%;
        background: #cfe0ff;
        opacity: 0.8;
      }

      .ss-bullet {
        position: absolute;
        width: 4px;
        height: 12px;
        border-radius: 2px;

        &.player {
          background: #7fd7ff;
          box-shadow: 0 0 6px rgba(127, 215, 255, 0.8);
        }

        &.enemy {
          background: #ff5e5e;
          box-shadow: 0 0 6px rgba(255, 94, 94, 0.7);
        }
      }

      .ss-enemy {
        position: absolute;
        border-radius: 5px;

        &.basic {
          width: 24px;
          height: 20px;
          background: #ff9e5e;
          box-shadow: 0 0 6px rgba(255, 158, 94, 0.6);
        }

        &.tough {
          width: 30px;
          height: 26px;
          background: #ff5e8a;
          box-shadow: 0 0 8px rgba(255, 94, 138, 0.65);
        }

        &.milestone {
          width: 44px;
          height: 34px;
          background: #c25eff;
          box-shadow: 0 0 14px rgba(194, 94, 255, 0.75);
          border-radius: 8px;
        }
      }

      .ss-powerup {
        position: absolute;
        width: 20px;
        height: 20px;
        display: grid;
        place-items: center;
        font-size: 12px;
        border-radius: 50%;
        background: rgba(255, 224, 102, 0.18);
        border: 1px solid #ffe066;
        color: #ffe066;
        box-shadow: 0 0 8px rgba(255, 224, 102, 0.5);
      }

      .ss-explosion {
        position: absolute;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #fff2b0;
        box-shadow: 0 0 0 rgba(255, 200, 100, 0.8);
        pointer-events: none;
        animation: explosion-burst 0.4s ease-out both;
      }

      .ss-player {
        position: absolute;
        width: 30px;
        height: 22px;
        background: #4d7fff;
        clip-path: polygon(50% 0, 100% 100%, 50% 78%, 0 100%);
        box-shadow: 0 0 10px rgba(77, 127, 255, 0.7);

        &.blink {
          opacity: 0.35;
        }

        &.shielded {
          box-shadow: 0 0 0 3px rgba(255, 224, 102, 0.5), 0 0 14px rgba(255, 224, 102, 0.6);
        }
      }
    }

    .ss-panel {
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      color: #4d7fff;
      font-weight: 800;
      text-shadow: 0 0 6px rgba(77, 127, 255, 0.45);

      &.sub {
        margin-top: 4px;
        font-size: 0.78rem;
        color: #c7d6ff;
        text-shadow: none;
        font-weight: 700;
      }
    }

    .ss-message {
      margin-top: 14px;
      color: #c7d6ff;
      font-size: 0.85rem;
      animation: subtle-fade 2.8s ease-in-out infinite;
    }
  }

  .ss-help-panel {
    border: 1px solid rgba(77, 127, 255, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(8, 14, 34, 0.5);

    .ss-help-title {
      margin: 0 0 6px;
      color: #4d7fff;
      font-size: 0.75rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .ss-help-text {
      margin: 0;
      color: #c7d6ff;
      font-size: 0.78rem;
      line-height: 1.6;
    }
  }
}

@keyframes title-float {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-2px);
  }
}

@keyframes frame-glow {

  0%,
  100% {
    box-shadow: 0 0 0 1px rgba(77, 127, 255, 0.2), 0 0 24px rgba(77, 127, 255, 0.16);
  }

  50% {
    box-shadow: 0 0 0 1px rgba(150, 180, 255, 0.35), 0 0 40px rgba(77, 127, 255, 0.3);
  }
}

@keyframes subtle-fade {

  0%,
  100% {
    opacity: 0.7;
  }

  50% {
    opacity: 1;
  }
}

@keyframes stage-shake {
  0% {
    transform: translate3d(0, 0, 0);
  }

  25% {
    transform: translate3d(-4px, 2px, 0);
  }

  50% {
    transform: translate3d(4px, -2px, 0);
  }

  75% {
    transform: translate3d(-3px, 2px, 0);
  }

  100% {
    transform: translate3d(0, 0, 0);
  }
}

@keyframes explosion-burst {
  0% {
    opacity: 1;
    transform: scale(0.6);
    box-shadow: 0 0 0 0 rgba(255, 200, 100, 0.8);
  }

  100% {
    opacity: 0;
    transform: scale(2.6);
    box-shadow: 0 0 16px 10px rgba(255, 140, 60, 0);
  }
}

@media (max-width: 980px) {
  .ss-page {
    .ss-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .ss-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
