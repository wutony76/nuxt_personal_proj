<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'

type InvadersStatus = 'ready' | 'playing' | 'pause' | 'gameover'
type Bullet = { id: number; x: number; y: number }
type FormationMember = { id: number; row: number; col: number; alive: boolean }
type RenderEnemy = { id: number; row: number; x: number; y: number }
type Bunker = { id: number; x: number; y: number; cells: boolean[][] }
type Ufo = { id: number; x: number; y: number; dir: -1 | 1; bonus: number }
type Explosion = { id: number; x: number; y: number }
type StepReason = 'lives' | 'invasion' | null
type StepResult = { gameOver: boolean; hitTaken: boolean; reason: StepReason; explosions: Array<{ x: number; y: number }> }

const STAGE_WIDTH = 400
const STAGE_HEIGHT = 460

const ROWS = 5
const COLS = 8
const ENEMY_WIDTH = 22
const ENEMY_HEIGHT = 16
const GAP_X = 10
const GAP_Y = 12
const FORMATION_START_X = (STAGE_WIDTH - (COLS * ENEMY_WIDTH + (COLS - 1) * GAP_X)) / 2
const FORMATION_START_Y = 26
const ROW_DROP = 14
const STEP_SIZE = 6
/** 由上到下每列給分，越上排分越高，見 design.md Decision 9 */
const ROW_SCORES = [40, 40, 30, 20, 10]
const ROW_COLORS = ['#ff3b3b', '#ff3b3b', '#ff8a5e', '#ffd45e', '#8fd9ff']

const PLAYER_WIDTH = 30
const PLAYER_HEIGHT = 22
const PLAYER_Y = STAGE_HEIGHT - 46
const PLAYER_SPEED = 5
const PLAYER_HITBOX_SHRINK = 6

const BULLET_WIDTH = 4
const BULLET_HEIGHT = 10
const PLAYER_BULLET_SPEED = 8
const ENEMY_BULLET_SPEED = 2.6

const LIVES_START = 3
const INVULN_TICKS = 94
const TICK_MS = 16
const READY_START = 3

/** 掩體格子圖案（簡化版：頂部拱形＋底部留兩個缺口），見 design.md Decision 5 */
const BUNKER_PATTERN: boolean[][] = [
  [false, true, true, true, true, false],
  [true, true, true, true, true, true],
  [true, true, true, true, true, true],
  [true, true, false, false, true, true]
]
const CELL_SIZE = 6
const BUNKER_COLS = BUNKER_PATTERN[0]!.length
const BUNKER_ROWS = BUNKER_PATTERN.length
const BUNKER_WIDTH = BUNKER_COLS * CELL_SIZE
const BUNKER_Y = 300
const BUNKER_COUNT = 4

/** 隊形下降超過此線即立即結束，不論剩餘生命數，見 design.md Decision 7 */
const DEATH_LINE_Y = PLAYER_Y - 4

const UFO_WIDTH = 30
const UFO_HEIGHT = 14
const UFO_Y = 16
const UFO_SPEED = 1.6
const UFO_MIN_TICKS = 1200
const UFO_MAX_TICKS = 2400
const UFO_BONUSES = [50, 100, 150, 300]

const BASE_MOVE_INTERVAL_START = 42
const MOVE_INTERVAL_WAVE_STEP = 4
const MOVE_INTERVAL_MIN = 10
/** 存活比例越低，移動間隔的乘數越小（越快），見 design.md Decision 2 */
const ALIVE_RATIO_MULTIPLIERS: Array<{ min: number; mult: number }> = [
  { min: 0.8, mult: 1 },
  { min: 0.5, mult: 0.7 },
  { min: 0.2, mult: 0.45 },
  { min: 0, mult: 0.22 }
]

const FIRE_CHANCE_BASE = 0.004
const FIRE_CHANCE_PER_WAVE = 0.0012
const FIRE_CHANCE_MAX = 0.02

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

const baseX = (col: number) => FORMATION_START_X + col * (ENEMY_WIDTH + GAP_X)
const baseY = (row: number) => FORMATION_START_Y + row * (ENEMY_HEIGHT + GAP_Y)

/**
 * 傳統太空侵略者核心邏輯：固定隊形整批同步移動＋隨存活數加速、玩家同時最多 1 發子彈、
 * 可逐格摧毀的防禦掩體、UFO 隨機獎勵分、隊形觸底即死（獨立於生命值歸零）。
 * 只有這一款遊戲用到，不抽到 app/utils/（見 openspec/changes/add-space-invaders-game/design.md）。
 */
class SpaceInvadersEngine {
  playerX = STAGE_WIDTH / 2 - PLAYER_WIDTH / 2
  playerBullet: Bullet | null = null
  enemyBullets: Bullet[] = []
  members: FormationMember[] = []
  offsetX = 0
  offsetY = 0
  dir: -1 | 1 = 1
  moveCooldown = BASE_MOVE_INTERVAL_START
  bunkers: Bunker[] = []
  ufo: Ufo | null = null
  nextUfoTicks = UFO_MIN_TICKS
  score = 0
  wave = 1
  lives = LIVES_START
  invulnTicks = 0
  private nextId = 1

  constructor() {
    this.buildFormation()
    this.buildBunkers()
  }

  reset() {
    this.playerX = STAGE_WIDTH / 2 - PLAYER_WIDTH / 2
    this.playerBullet = null
    this.enemyBullets = []
    this.score = 0
    this.wave = 1
    this.lives = LIVES_START
    this.invulnTicks = 0
    this.ufo = null
    this.nextUfoTicks = UFO_MIN_TICKS
    this.buildFormation()
    this.buildBunkers()
  }

  private buildFormation() {
    this.members = []
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        this.members.push({ id: this.nextId++, row, col, alive: true })
      }
    }
    this.offsetX = 0
    this.offsetY = 0
    this.dir = 1
    this.moveCooldown = this.computeMoveInterval()
  }

  private buildBunkers() {
    const spacing = STAGE_WIDTH / BUNKER_COUNT
    this.bunkers = Array.from({ length: BUNKER_COUNT }, (_, i) => ({
      id: this.nextId++,
      x: spacing * i + spacing / 2 - BUNKER_WIDTH / 2,
      y: BUNKER_Y,
      cells: BUNKER_PATTERN.map((row) => [...row])
    }))
  }

  private aliveMembers() {
    return this.members.filter((m) => m.alive)
  }

  private computeMoveInterval(): number {
    const alive = this.aliveMembers().length
    const ratio = alive / (ROWS * COLS)
    const mult = ALIVE_RATIO_MULTIPLIERS.find((r) => ratio >= r.min)?.mult ?? 1
    const base = Math.max(MOVE_INTERVAL_MIN, BASE_MOVE_INTERVAL_START - (this.wave - 1) * MOVE_INTERVAL_WAVE_STEP)
    return Math.max(4, Math.round(base * mult))
  }

  private memberBox(member: FormationMember) {
    return { x: baseX(member.col) + this.offsetX, y: baseY(member.row) + this.offsetY, w: ENEMY_WIDTH, h: ENEMY_HEIGHT }
  }

  private frontlineMembers(): FormationMember[] {
    const map = new Map<number, FormationMember>()
    this.aliveMembers().forEach((m) => {
      const current = map.get(m.col)
      if (!current || m.row > current.row) map.set(m.col, m)
    })
    return [...map.values()]
  }

  private spawnUfo() {
    const fromLeft = Math.random() < 0.5
    this.ufo = {
      id: this.nextId++,
      x: fromLeft ? -UFO_WIDTH : STAGE_WIDTH,
      y: UFO_Y,
      dir: fromLeft ? 1 : -1,
      bonus: UFO_BONUSES[Math.floor(Math.random() * UFO_BONUSES.length)]!
    }
  }

  /** 掩體摧毀判定：命中任一存活格子即摧毀該格並回傳 true（供子彈/敵彈判定是否被掩體擋下） */
  private destroyBunkerCellAt(box: { x: number; y: number; w: number; h: number }): boolean {
    for (const bunker of this.bunkers) {
      for (let r = 0; r < BUNKER_ROWS; r += 1) {
        for (let c = 0; c < BUNKER_COLS; c += 1) {
          if (!bunker.cells[r]![c]) continue
          const cellBox = { x: bunker.x + c * CELL_SIZE, y: bunker.y + r * CELL_SIZE, w: CELL_SIZE, h: CELL_SIZE }
          if (overlaps(box, cellBox)) {
            bunker.cells[r]![c] = false
            return true
          }
        }
      }
    }
    return false
  }

  private takeDamage(): boolean {
    if (this.invulnTicks > 0) return false
    this.lives -= 1
    this.invulnTicks = INVULN_TICKS
    this.playerX = STAGE_WIDTH / 2 - PLAYER_WIDTH / 2
    return true
  }

  step(moveDir: -1 | 0 | 1, firing: boolean): StepResult {
    const explosions: Array<{ x: number; y: number }> = []
    let hitTaken = false
    let reason: StepReason = null

    // 玩家移動與無敵時間
    this.playerX = Math.max(0, Math.min(STAGE_WIDTH - PLAYER_WIDTH, this.playerX + moveDir * PLAYER_SPEED))
    if (this.invulnTicks > 0) this.invulnTicks -= 1

    // 玩家開火：同時最多 1 發，見 design.md Decision 3
    if (firing && !this.playerBullet) {
      this.playerBullet = { id: this.nextId++, x: this.playerX + PLAYER_WIDTH / 2 - BULLET_WIDTH / 2, y: PLAYER_Y - BULLET_HEIGHT }
    }
    if (this.playerBullet) {
      this.playerBullet.y -= PLAYER_BULLET_SPEED
      if (this.playerBullet.y + BULLET_HEIGHT < 0) this.playerBullet = null
    }

    // 神秘 UFO：獨立於隊形之外，見 design.md Decision 6
    if (this.ufo) {
      this.ufo.x += this.ufo.dir * UFO_SPEED
      if (this.ufo.x < -UFO_WIDTH - 10 || this.ufo.x > STAGE_WIDTH + 10) this.ufo = null
    } else {
      this.nextUfoTicks -= 1
      if (this.nextUfoTicks <= 0) {
        this.spawnUfo()
        this.nextUfoTicks = UFO_MIN_TICKS + Math.floor(Math.random() * (UFO_MAX_TICKS - UFO_MIN_TICKS))
      }
    }

    // 隊形整批同步移動：碰邊界下降並反向，見 design.md Decision 1
    this.moveCooldown -= 1
    if (this.moveCooldown <= 0) {
      const alive = this.aliveMembers()
      if (alive.length > 0) {
        let minX = Number.POSITIVE_INFINITY
        let maxX = Number.NEGATIVE_INFINITY
        alive.forEach((m) => {
          const x = baseX(m.col) + this.offsetX + this.dir * STEP_SIZE
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x + ENEMY_WIDTH)
        })
        if (minX < 0 || maxX > STAGE_WIDTH) {
          this.offsetY += ROW_DROP
          this.dir = this.dir === 1 ? -1 : 1
        } else {
          this.offsetX += this.dir * STEP_SIZE
        }
        if (alive.some((m) => baseY(m.row) + this.offsetY + ENEMY_HEIGHT >= DEATH_LINE_Y)) {
          reason = 'invasion'
        }
      }
      this.moveCooldown = this.computeMoveInterval()
    }

    // 敵機還擊：僅每欄最前線可開火，見 design.md Decision 4
    if (reason !== 'invasion') {
      this.frontlineMembers().forEach((member) => {
        const fireChance = Math.min(FIRE_CHANCE_MAX, FIRE_CHANCE_BASE + (this.wave - 1) * FIRE_CHANCE_PER_WAVE)
        if (Math.random() < fireChance) {
          const box = this.memberBox(member)
          this.enemyBullets.push({ id: this.nextId++, x: box.x + ENEMY_WIDTH / 2 - BULLET_WIDTH / 2, y: box.y + ENEMY_HEIGHT })
        }
      })
    }

    this.enemyBullets.forEach((b) => {
      b.y += ENEMY_BULLET_SPEED
    })
    this.enemyBullets = this.enemyBullets.filter((b) => b.y < STAGE_HEIGHT + BULLET_HEIGHT)

    // 玩家子彈：依序判定掩體 → UFO → 敵機，命中即消耗
    if (this.playerBullet) {
      const bulletBox = { x: this.playerBullet.x, y: this.playerBullet.y, w: BULLET_WIDTH, h: BULLET_HEIGHT }
      if (this.destroyBunkerCellAt(bulletBox)) {
        this.playerBullet = null
      } else if (this.ufo && overlaps(bulletBox, { x: this.ufo.x, y: this.ufo.y, w: UFO_WIDTH, h: UFO_HEIGHT })) {
        this.score += this.ufo.bonus
        explosions.push({ x: this.ufo.x + UFO_WIDTH / 2, y: this.ufo.y + UFO_HEIGHT / 2 })
        this.ufo = null
        this.playerBullet = null
      } else {
        const hit = this.aliveMembers().find((m) => overlaps(bulletBox, this.memberBox(m)))
        if (hit) {
          hit.alive = false
          this.score += ROW_SCORES[hit.row] ?? 10
          const box = this.memberBox(hit)
          explosions.push({ x: box.x + ENEMY_WIDTH / 2, y: box.y + ENEMY_HEIGHT / 2 })
          this.playerBullet = null
        }
      }
    }

    // 敵彈 vs 掩體／玩家
    const playerBox = {
      x: this.playerX + PLAYER_HITBOX_SHRINK,
      y: PLAYER_Y + PLAYER_HITBOX_SHRINK,
      w: PLAYER_WIDTH - PLAYER_HITBOX_SHRINK * 2,
      h: PLAYER_HEIGHT - PLAYER_HITBOX_SHRINK * 2
    }
    this.enemyBullets = this.enemyBullets.filter((b) => {
      const box = { x: b.x, y: b.y, w: BULLET_WIDTH, h: BULLET_HEIGHT }
      if (this.destroyBunkerCellAt(box)) return false
      if (this.invulnTicks <= 0 && overlaps(box, playerBox)) {
        if (this.takeDamage()) hitTaken = true
        return false
      }
      return true
    })

    // 敵機本體 vs 掩體／玩家（本體路過會打爛掩體，撞到玩家則雙方同歸於盡）
    this.aliveMembers().forEach((m) => {
      const box = this.memberBox(m)
      this.destroyBunkerCellAt(box)
      if (this.invulnTicks <= 0 && overlaps(box, playerBox)) {
        m.alive = false
        if (this.takeDamage()) hitTaken = true
      }
    })

    // 波次清空：見 design.md Decision 8，掩體／生命值／分數不隨波次重置
    if (reason !== 'invasion' && this.aliveMembers().length === 0) {
      this.wave += 1
      this.buildFormation()
    }

    const gameOver = reason === 'invasion' || this.lives <= 0
    if (gameOver && reason === null) reason = 'lives'

    return { gameOver, hitTaken, reason: gameOver ? reason : null, explosions }
  }

  getSnapshot() {
    return {
      playerX: this.playerX,
      playerBullet: this.playerBullet ? { ...this.playerBullet } : null,
      enemyBullets: this.enemyBullets.map((b) => ({ ...b })),
      enemies: this.aliveMembers().map((m) => {
        const box = this.memberBox(m)
        return { id: m.id, row: m.row, x: box.x, y: box.y } as RenderEnemy
      }),
      bunkers: this.bunkers.map((b) => ({ id: b.id, x: b.x, y: b.y, cells: b.cells.map((row) => [...row]) })),
      ufo: this.ufo ? { ...this.ufo } : null,
      score: this.score,
      wave: this.wave,
      lives: this.lives,
      invulnTicks: this.invulnTicks
    }
  }
}

const router = useRouter()
const engine = new SpaceInvadersEngine()
const gameHistory = useGameHistory()

const state = reactive({
  status: 'ready' as InvadersStatus,
  playerX: engine.playerX,
  playerBullet: null as Bullet | null,
  enemyBullets: [] as Bullet[],
  enemies: [] as RenderEnemy[],
  bunkers: [] as Bunker[],
  ufo: null as Ufo | null,
  explosions: [] as Explosion[],
  score: 0,
  wave: 1,
  lives: LIVES_START,
  invulnTicks: 0,
  stageShake: false,
  message: '按「開始」後用 ←/→ 或 A/D 移動，空白鍵開火（同時最多 1 發）。',
  rewardMessage: '',
  waitingOverlayVisible: true,
  readyOverlayVisible: false,
  readyCountdownValue: READY_START,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const SPACE_INVADERS_RULE = {
  description:
    '←/→ 或 A/D 移動砲台，按住空白鍵／Enter 開火；畫面上同時最多存在 1 發己方子彈，需等子彈擊中目標或飛出畫面才能再次開火。' +
    '外星艦隊整批同步移動，碰到邊界會整批下降一列並反向，存活敵機越少、移動越快。防禦掩體會被雙方子彈與敵機本體逐格打爛且不會修復。' +
    '神秘 UFO 不定期從畫面上方飛過，擊中可獲得隨機獎勵分。共有 3 條命，被敵彈或敵機本體擊中扣 1 命並短暫無敵；' +
    '若敵機隊形下降抵達底線，不論剩餘生命數皆立即結束遊戲。',
  scoreRule: 'SCORE ＝ 依敵機所在列給分（越上排分越高：40/40/30/20/10）＋ UFO 隨機獎勵分（50/100/150/300）累加，開放式無上限。',
  levels: [
    { level: '存活 > 80%', condition: '基礎移動速度' },
    { level: '存活 50%～80%', condition: '移動速度提升' },
    { level: '存活 20%～50%', condition: '移動速度明顯提升' },
    { level: '存活 < 20%', condition: '移動速度大幅提升' }
  ],
  levelsTitle: '隊形加速節奏',
  note: '清空一整波敵機即進入下一波，隊形重新滿編出現，基礎速度與敵機開火機率隨波次提升；掩體損毀狀態、生命值與分數不會因換波而重置。'
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
const bunkerCells = computed(() => {
  const cells: Array<{ key: string; x: number; y: number }> = []
  state.bunkers.forEach((bunker) => {
    bunker.cells.forEach((row, r) => {
      row.forEach((alive, c) => {
        if (!alive) return
        cells.push({ key: `${bunker.id}-${r}-${c}`, x: bunker.x + c * CELL_SIZE, y: bunker.y + r * CELL_SIZE })
      })
    })
  })
  return cells
})

/** 私有工具方法：計時器管理、狀態同步 */
const _handlers = {
  syncState: (explosions?: Array<{ x: number; y: number }>) => {
    const snap = engine.getSnapshot()
    state.playerX = snap.playerX
    state.playerBullet = snap.playerBullet
    state.enemyBullets = snap.enemyBullets
    state.enemies = snap.enemies
    state.bunkers = snap.bunkers
    state.ufo = snap.ufo
    state.score = snap.score
    state.wave = snap.wave
    state.lives = snap.lives
    state.invulnTicks = snap.invulnTicks
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
  rowColor: (row: number) => ROW_COLORS[row] ?? '#ff3b3b'
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('spaceInvaders', 'SPACE INVADERS', {
        score: state.score,
        level: state.wave
      })
      if (result.coinReward > 0) {
        state.rewardMessage = result.coinCapped ? `+${result.coinReward} coin（已達今日上限）` : `+${result.coinReward} coin`
      }
    } catch {
      // 紀錄寫入失敗不影響遊戲本身，靜默略過
    }
  },
  finishGame: (reason: StepReason) => {
    state.status = 'gameover'
    state.message = reason === 'invasion' ? '外星艦隊已抵達底線，遊戲結束。' : '生命值歸零，遊戲結束。'
    state.resultOverlayVisible = true
    _handlers.stopTickTimer()
    _actions.recordHistory()
  },
  startTickLoop: () => {
    _handlers.stopTickTimer()
    tickTimer = setInterval(() => {
      if (state.status !== 'playing') return
      const result: StepResult = engine.step(_handlers.currentMoveDir(), fireHeld)
      _handlers.syncState(result.explosions)
      if (result.hitTaken) _handlers.triggerShake()
      if (result.gameOver) {
        _actions.finishGame(result.reason)
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
    state.message = '按「開始」後用 ←/→ 或 A/D 移動，空白鍵開火（同時最多 1 發）。'
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

const onInvadersKeydown = (event: KeyboardEvent) => {
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
const onInvadersKeyup = (event: KeyboardEvent) => {
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
    window.addEventListener('keydown', onInvadersKeydown)
    window.addEventListener('keyup', onInvadersKeyup)
  }
  _actions.resetGame()
  state.waitingOverlayVisible = true
})

onBeforeUnmount(() => {
  _handlers.stopTickTimer()
  _handlers.stopReadyTimer()
  _handlers.stopShakeTimer()
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onInvadersKeydown)
    window.removeEventListener('keyup', onInvadersKeyup)
  }
})
</script>

<template>
  <main class="si-page" :class="`state-${state.status}`">
    <div class="si-overlay" />
    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">SPACE INVADERS</p>
      <button class="si-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="si-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="si-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
    </div>
    <div v-if="state.readyOverlayVisible" class="game-mask ready-mask">
      <div class="mask-title">READY</div>
      <div class="mask-count">{{ state.readyCountdownValue }}</div>
    </div>
    <div v-if="state.resultOverlayVisible" class="game-mask result-mask">
      <div class="mask-title">RESULT</div>
      <div class="result-list">
        <div class="result-item"><span>SCORE</span><b>{{ state.score }}</b></div>
        <div class="result-item"><span>WAVE</span><b>{{ state.wave }}</b></div>
      </div>
      <p v-if="state.rewardMessage" class="result-reward">{{ state.rewardMessage }}</p>
      <div class="result-actions">
        <button class="si-btn" type="button" @click="click.again">AGAIN</button>
        <button class="si-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="spaceInvaders" game-name="SPACE INVADERS"
      accent-color="#ff3b3b" @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="SPACE INVADERS" accent-color="#ff3b3b"
      v-bind="SPACE_INVADERS_RULE" @close="click.closeRuleDialog" />

    <section class="si-shell">
      <aside class="si-side left">
        <button class="si-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="si-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="si-btn" type="button" @click="click.replay">REPLAY</button>
        <button class="si-btn link" type="button" @click="click.end">END</button>
        <button class="si-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="si-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="si-center">
        <header class="si-title-wrap">
          <h1 class="si-title">SPACE INVADERS</h1>
          <p class="si-status" :class="statusClass">{{ statusText }}</p>
        </header>

        <div class="si-frame">
          <div class="si-stage" :class="{ shake: state.stageShake }">
            <div v-for="cell in bunkerCells" :key="cell.key" class="si-bunker-cell"
              :style="`left:${cell.x}px; top:${cell.y}px;`" />

            <div v-if="state.ufo" class="si-ufo" :style="`left:${state.ufo.x}px; top:${state.ufo.y}px;`" />

            <div v-for="e in state.enemies" :key="e.id" class="si-enemy"
              :style="`left:${e.x}px; top:${e.y}px; background:${_handlers.rowColor(e.row)}; box-shadow:0 0 6px ${_handlers.rowColor(e.row)}99;`" />

            <div v-for="b in state.enemyBullets" :key="b.id" class="si-bullet enemy"
              :style="`left:${b.x}px; top:${b.y}px;`" />
            <div v-if="state.playerBullet" class="si-bullet player"
              :style="`left:${state.playerBullet.x}px; top:${state.playerBullet.y}px;`" />

            <div v-for="ex in state.explosions" :key="ex.id" class="si-explosion"
              :style="`left:${ex.x}px; top:${ex.y}px;`" />

            <div class="si-player" :class="{ blink: isInvulnBlinking }"
              :style="`left:${state.playerX}px; top:${PLAYER_Y}px;`" />
          </div>
          <div class="si-panel">
            <span>SCORE: {{ state.score }}</span>
            <span>WAVE: {{ state.wave }}</span>
            <span>LIVES: {{ '❤'.repeat(Math.max(0, state.lives)) }}</span>
          </div>
        </div>

        <p class="si-message">{{ state.message }}</p>
      </section>

      <aside class="si-side right">
        <div class="si-help-panel">
          <p class="si-help-title">HOW TO PLAY</p>
          <p class="si-help-text">←/→ 或 A/D 移動，空白鍵開火（同時最多 1 發）；外星艦隊整批移動，碰邊界下降加速；掩體會逐格被打爛；擊中 UFO 得隨機獎勵分；3 條命，敵機隊形抵達底線立即結束。</p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.si-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #1a0606, #050101 60%);
  overflow: hidden;
  isolation: isolate;

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset: -20%;
    pointer-events: none;
    z-index: 0;
  }

  &::before {
    background: radial-gradient(circle at 20% 20%, rgba(255, 59, 59, 0.16), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(255, 140, 140, 0.1), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(255, 59, 59, 0.05), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .si-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(255, 59, 59, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 59, 59, 0.05) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
    z-index: 0;
    animation: grid-drift 14s linear infinite;
  }

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
      color: #ff3b3b;
      font-size: clamp(2rem, 8vw, 4rem);
      letter-spacing: 0.25rem;
      font-weight: 900;
    }

    .mask-count {
      color: #ff3b3b;
      font-size: clamp(3rem, 12vw, 7rem);
      font-weight: 900;
      line-height: 1;
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #ffb0a9;
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
        border: 1px solid rgba(255, 59, 59, 0.4);
        background: rgba(40, 10, 10, 0.65);
        color: #ffd6d3;
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

  .si-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: center;
  }

  .si-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .si-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255, 59, 59, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(34, 8, 8, 0.75);
    color: #ff3b3b;
    font-weight: 700;
    letter-spacing: 0.5px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(255, 190, 190, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover {
      border-color: #ff3b3b;
      box-shadow: 0 0 12px rgba(255, 59, 59, 0.35);
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
      border-color: rgba(255, 120, 60, 0.5);
      color: #ff9d7d;
    }
  }

  .si-center {
    text-align: center;

    .si-title-wrap {
      margin-bottom: 8px;
    }

    .si-title {
      margin: 0;
      color: #ff3b3b;
      font-size: clamp(1.5rem, 4.4vw, 2.6rem);
      letter-spacing: 0.1rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(255, 59, 59, 0.5);
      animation: title-float 2.6s ease-in-out infinite;
    }

    .si-status {
      margin: 2px 0 0;
      color: #ffd6d3;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;

      &.is-playing {
        color: #ff3b3b;
      }

      &.is-pause {
        color: #ffcc33;
      }

      &.is-gameover {
        color: #ff5e5e;
      }
    }

    .si-frame {
      width: fit-content;
      margin: 12px auto 0;
      padding: 12px;
      background: #0a0202;
      border: 10px solid #401313;
      border-radius: 18px;
      box-shadow: 0 0 0 1px rgba(255, 59, 59, 0.2), 0 0 24px rgba(255, 59, 59, 0.16);
      animation: frame-glow 5.4s ease-in-out infinite;
    }

    .si-stage {
      box-sizing: content-box;
      position: relative;
      width: 400px;
      height: 460px;
      background: #050101;
      border: 2px solid #000;
      border-radius: 8px;
      overflow: hidden;

      &.shake {
        animation: stage-shake 260ms ease-out;
      }

      .si-bullet {
        position: absolute;
        width: 4px;
        height: 10px;
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

      .si-enemy {
        position: absolute;
        width: 22px;
        height: 16px;
        border-radius: 4px;
      }

      .si-bunker-cell {
        position: absolute;
        width: 6px;
        height: 6px;
        background: #7fbf5e;
        box-shadow: 0 0 3px rgba(127, 191, 94, 0.5);
      }

      .si-ufo {
        position: absolute;
        width: 30px;
        height: 14px;
        border-radius: 50%;
        background: #ff9e5e;
        box-shadow: 0 0 10px rgba(255, 158, 94, 0.8);
      }

      .si-explosion {
        position: absolute;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #fff2b0;
        box-shadow: 0 0 0 rgba(255, 200, 100, 0.8);
        pointer-events: none;
        animation: explosion-burst 0.4s ease-out both;
      }

      .si-player {
        position: absolute;
        width: 30px;
        height: 22px;
        background: #ff3b3b;
        clip-path: polygon(50% 0, 100% 100%, 50% 78%, 0 100%);
        box-shadow: 0 0 10px rgba(255, 59, 59, 0.7);

        &.blink {
          opacity: 0.35;
        }
      }
    }

    .si-panel {
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      color: #ff3b3b;
      font-weight: 800;
      text-shadow: 0 0 6px rgba(255, 59, 59, 0.45);
    }

    .si-message {
      margin-top: 14px;
      color: #ffd6d3;
      font-size: 0.85rem;
      animation: subtle-fade 2.8s ease-in-out infinite;
    }
  }

  .si-help-panel {
    border: 1px solid rgba(255, 59, 59, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(34, 8, 8, 0.5);

    .si-help-title {
      margin: 0 0 6px;
      color: #ff3b3b;
      font-size: 0.75rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .si-help-text {
      margin: 0;
      color: #ffd6d3;
      font-size: 0.78rem;
      line-height: 1.6;
    }
  }
}

@keyframes ambient-drift {
  0% {
    transform: translate(-1.5%, -1%) scale(1);
  }

  100% {
    transform: translate(1.5%, 1%) scale(1.06);
  }
}

@keyframes ambient-pulse {

  0%,
  100% {
    opacity: 0.35;
  }

  50% {
    opacity: 0.75;
  }
}

@keyframes grid-drift {
  0% {
    transform: translate(0, 0);
  }

  100% {
    transform: translate(14px, 14px);
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
    box-shadow: 0 0 0 1px rgba(255, 59, 59, 0.2), 0 0 24px rgba(255, 59, 59, 0.16);
  }

  50% {
    box-shadow: 0 0 0 1px rgba(255, 150, 150, 0.35), 0 0 40px rgba(255, 59, 59, 0.3);
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
  .si-page {
    .si-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .si-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
