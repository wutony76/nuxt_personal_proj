<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameHistory } from '~/composables/useGameHistory'

type BreakoutStatus = 'ready' | 'playing' | 'pause' | 'gameover'
type Brick = { id: number; row: number; x: number; y: number; alive: boolean }
type Particle = { id: number; x: number; y: number }

const STAGE_WIDTH = 400
const STAGE_HEIGHT = 460

const PADDLE_WIDTH = 70
const PADDLE_HEIGHT = 12
const PADDLE_Y = STAGE_HEIGHT - 28
const PADDLE_SPEED = 6

const BALL_SIZE = 10
const BALL_BASE_SPEED = 3
const BALL_MAX_BOUNCE_VX = 4.2
const BALL_SPEED_GROWTH = 0.015
const BALL_SPEED_GROWTH_CAP = 0.4

const BRICK_COLS = 10
const BRICK_WIDTH = 32
const BRICK_HEIGHT = 14
const BRICK_GAP_X = 4
const BRICK_GAP_Y = 6
const BRICK_TOP = 40
const BRICK_COLORS = ['#ff5e5e', '#ff9e5e', '#ffd45e', '#8fd9ff', '#8fff9e', '#c9a0ff']

const LIVES_START = 3
const TICK_MS = 16
const READY_START = 3

/** 固定關卡陣列，比照 MINESWEEPER 的 LEVELS 先例，見 add-breakout-game design.md Decision 3 */
const LEVELS: Array<{ rows: number; baseSpeedMul: number }> = [
  { rows: 4, baseSpeedMul: 1 },
  { rows: 5, baseSpeedMul: 1.1 },
  { rows: 5, baseSpeedMul: 1.25 },
  { rows: 6, baseSpeedMul: 1.4 },
  { rows: 6, baseSpeedMul: 1.55 }
]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/**
 * 打磚塊核心邏輯：Paddle 移動、球向量物理（比照 PongEngine 的撞擊位置反彈角手法，座標軸互換）、
 * 磚塊 AABB 碰撞＋最小重疊軸判斷撞擊面、關卡陣列、生命值。只有這一款遊戲用到，
 * 不抽到 app/utils/（見 add-breakout-game design.md）。
 */
class BreakoutEngine {
  paddleX = STAGE_WIDTH / 2 - PADDLE_WIDTH / 2
  ballX = 0
  ballY = 0
  ballVX = 0
  ballVY = -BALL_BASE_SPEED
  launched = false
  bricks: Brick[] = []
  score = 0
  level = 1
  lives = LIVES_START
  private speedMul = 1
  private totalRowsThisLevel = 4
  private nextId = 1

  constructor() {
    this.reset()
  }

  reset() {
    this.paddleX = STAGE_WIDTH / 2 - PADDLE_WIDTH / 2
    this.score = 0
    this.level = 1
    this.lives = LIVES_START
    this.buildBricks(0)
    this.resetBall()
  }

  private levelConfig(levelIndex: number) {
    const clampedIndex = Math.min(levelIndex, LEVELS.length - 1)
    const base = LEVELS[clampedIndex]!
    const extra = Math.max(0, levelIndex - (LEVELS.length - 1)) * 0.1
    return { rows: base.rows, baseSpeedMul: base.baseSpeedMul + extra }
  }

  private buildBricks(levelIndex: number) {
    const cfg = this.levelConfig(levelIndex)
    const totalWidth = BRICK_COLS * BRICK_WIDTH + (BRICK_COLS - 1) * BRICK_GAP_X
    const startX = (STAGE_WIDTH - totalWidth) / 2
    const bricks: Brick[] = []
    for (let row = 0; row < cfg.rows; row += 1) {
      for (let col = 0; col < BRICK_COLS; col += 1) {
        bricks.push({
          id: this.nextId++,
          row,
          x: startX + col * (BRICK_WIDTH + BRICK_GAP_X),
          y: BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP_Y),
          alive: true
        })
      }
    }
    this.bricks = bricks
    this.totalRowsThisLevel = cfg.rows
    this.speedMul = cfg.baseSpeedMul
  }

  private syncBallToPaddle() {
    this.ballX = this.paddleX + PADDLE_WIDTH / 2 - BALL_SIZE / 2
    this.ballY = PADDLE_Y - BALL_SIZE - 2
  }

  private resetBall() {
    this.launched = false
    this.ballVX = 0
    this.ballVY = -BALL_BASE_SPEED
    this.syncBallToPaddle()
  }

  movePaddle(dir: -1 | 0 | 1) {
    this.paddleX = clamp(this.paddleX + dir * PADDLE_SPEED, 0, STAGE_WIDTH - PADDLE_WIDTH)
    if (!this.launched) this.syncBallToPaddle()
  }

  /** 玩家按空白鍵才發球，比照使用者規格明講的 Ball Launch 流程步驟，見 Decision 6 */
  launchBall() {
    if (this.launched) return
    this.launched = true
    this.ballVX = (Math.random() - 0.5) * 2.4
    this.ballVY = -BALL_BASE_SPEED
  }

  private bounceOffPaddle() {
    const relative = (this.ballX + BALL_SIZE / 2 - (this.paddleX + PADDLE_WIDTH / 2)) / (PADDLE_WIDTH / 2)
    this.ballVX = clamp(relative, -1, 1) * BALL_MAX_BOUNCE_VX
    this.ballVY = -BALL_BASE_SPEED
    this.ballY = PADDLE_Y - BALL_SIZE
  }

  /** AABB 重疊比對＋最小重疊軸判斷撞擊面，同一 tick 只處理第一個重疊磚塊，見 Decision 2 */
  private resolveBrickCollision(): { x: number; y: number; scoreDelta: number } | null {
    const ballBox = { x: this.ballX, y: this.ballY, w: BALL_SIZE, h: BALL_SIZE }
    for (const brick of this.bricks) {
      if (!brick.alive) continue
      const box = { x: brick.x, y: brick.y, w: BRICK_WIDTH, h: BRICK_HEIGHT }
      if (!overlaps(ballBox, box)) continue
      const overlapX = Math.min(ballBox.x + ballBox.w, box.x + box.w) - Math.max(ballBox.x, box.x)
      const overlapY = Math.min(ballBox.y + ballBox.h, box.y + box.h) - Math.max(ballBox.y, box.y)
      if (overlapX < overlapY) this.ballVX *= -1
      else this.ballVY *= -1
      brick.alive = false
      const cap = this.levelConfig(this.level - 1).baseSpeedMul + BALL_SPEED_GROWTH_CAP
      this.speedMul = Math.min(this.speedMul + BALL_SPEED_GROWTH, cap)
      const scoreDelta = (this.totalRowsThisLevel - brick.row) * 10
      this.score += scoreDelta
      return { x: box.x + BRICK_WIDTH / 2, y: box.y + BRICK_HEIGHT / 2, scoreDelta }
    }
    return null
  }

  step(paddleDir: -1 | 0 | 1): { gameOver: boolean; ballLost: boolean; levelCleared: boolean; brickHit?: { x: number; y: number; scoreDelta: number } } {
    this.movePaddle(paddleDir)
    if (!this.launched) {
      return { gameOver: false, ballLost: false, levelCleared: false }
    }

    this.ballX += this.ballVX * this.speedMul
    this.ballY += this.ballVY * this.speedMul

    if (this.ballX <= 0) {
      this.ballX = 0
      this.ballVX *= -1
    } else if (this.ballX + BALL_SIZE >= STAGE_WIDTH) {
      this.ballX = STAGE_WIDTH - BALL_SIZE
      this.ballVX *= -1
    }
    if (this.ballY <= 0) {
      this.ballY = 0
      this.ballVY *= -1
    }

    const paddleBox = { x: this.paddleX, y: PADDLE_Y, w: PADDLE_WIDTH, h: PADDLE_HEIGHT }
    const ballBox = { x: this.ballX, y: this.ballY, w: BALL_SIZE, h: BALL_SIZE }
    if (this.ballVY > 0 && overlaps(ballBox, paddleBox)) {
      this.bounceOffPaddle()
    }

    const brickHit = this.resolveBrickCollision() ?? undefined

    let levelCleared = false
    if (this.bricks.every((b) => !b.alive)) {
      this.level += 1
      this.buildBricks(this.level - 1)
      this.resetBall()
      levelCleared = true
    }

    let ballLost = false
    let gameOver = false
    if (this.ballY > STAGE_HEIGHT) {
      this.lives -= 1
      ballLost = true
      this.resetBall()
      if (this.lives <= 0) gameOver = true
    }

    return { gameOver, ballLost, levelCleared, brickHit }
  }

  getSnapshot() {
    return {
      paddleX: this.paddleX,
      ballX: this.ballX,
      ballY: this.ballY,
      launched: this.launched,
      bricks: this.bricks.map((b) => ({ ...b })),
      score: this.score,
      level: this.level,
      lives: this.lives
    }
  }
}

const router = useRouter()
const engine = new BreakoutEngine()
const gameHistory = useGameHistory()

const state = reactive({
  status: 'ready' as BreakoutStatus,
  paddleX: engine.paddleX,
  ballX: 0,
  ballY: 0,
  launched: false,
  bricks: [] as Brick[],
  particles: [] as Particle[],
  score: 0,
  level: 1,
  lives: LIVES_START,
  transientMessage: '',
  stageShake: false,
  message: '按「開始」後用 ←/→ 或 A/D 移動擋板，空白鍵發球。',
  rewardMessage: '',
  waitingOverlayVisible: true,
  readyOverlayVisible: false,
  readyCountdownValue: READY_START,
  resultOverlayVisible: false,
  rateDialogOpen: false,
  ruleDialogOpen: false
})

const BREAKOUT_RULE = {
  description:
    '←/→ 或 A/D 移動擋板，空白鍵發球；球會自動飛行並依撞牆／擋板／磚塊反彈，擊中擋板不同位置會影響反彈角度。碰到磚塊即摧毀該磚塊並得分，清光整關磚塊即進入下一關（磚塊列數與球速上限提高）。' +
    '球掉出畫面底部扣 1 條命並重置擋板與球，需再次按空白鍵發球；共有 3 條命，命數歸零遊戲結束。',
  scoreRule: 'SCORE ＝ 依磚塊所在列給分（越上排、離擋板越遠分越高）累加，開放式無上限。',
  levelsTitle: '關卡難度',
  levels: LEVELS.map((lv, idx) => ({ level: idx + 1, condition: `${lv.rows} 列磚塊，球速倍率 ×${lv.baseSpeedMul.toFixed(2)}` })),
  note: '清光目前關卡的磚塊即進入下一關，分數與生命值不會重置；打完預設關卡後會持續沿用最後一關佈局並小幅提升球速。'
}

let tickTimer: ReturnType<typeof setInterval> | null = null
let readyTimer: ReturnType<typeof setInterval> | null = null
let shakeTimer: ReturnType<typeof setTimeout> | null = null
let transientMessageTimer: ReturnType<typeof setTimeout> | null = null
let particleCleanupId = 1
let moveLeftHeld = false
let moveRightHeld = false

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

/** 私有工具方法：計時器管理、狀態同步 */
const _handlers = {
  syncState: () => {
    const snap = engine.getSnapshot()
    state.paddleX = snap.paddleX
    state.ballX = snap.ballX
    state.ballY = snap.ballY
    state.launched = snap.launched
    state.bricks = snap.bricks
    state.score = snap.score
    state.level = snap.level
    state.lives = snap.lives
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
  stopTransientMessageTimer: () => {
    if (transientMessageTimer) {
      clearTimeout(transientMessageTimer)
      transientMessageTimer = null
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
  showTransientMessage: (text: string) => {
    _handlers.stopTransientMessageTimer()
    state.transientMessage = text
    transientMessageTimer = setTimeout(() => {
      state.transientMessage = ''
      transientMessageTimer = null
    }, 900)
  },
  pushParticle: (x: number, y: number) => {
    const id = particleCleanupId++
    state.particles.push({ id, x, y })
    setTimeout(() => {
      state.particles = state.particles.filter((p) => p.id !== id)
    }, 400)
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
  }
}

const _actions = {
  recordHistory: async () => {
    state.rewardMessage = ''
    try {
      const result = await gameHistory.actions.record('breakout', 'BREAKOUT', {
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
      const result = engine.step(_handlers.currentMoveDir())
      _handlers.syncState()
      if (result.brickHit) _handlers.pushParticle(result.brickHit.x, result.brickHit.y)
      if (result.levelCleared) _handlers.showTransientMessage('LEVEL CLEAR')
      if (result.ballLost) {
        _handlers.triggerShake()
        if (!result.gameOver) _handlers.showTransientMessage('BALL LOST')
      }
      if (result.gameOver) {
        _actions.finishGame()
      } else if ((result.ballLost || result.levelCleared) && !state.launched) {
        state.message = '按空白鍵發球！'
      }
    }, TICK_MS)
  },
  resetGame: () => {
    _handlers.stopTickTimer()
    _handlers.stopReadyTimer()
    _handlers.stopShakeTimer()
    _handlers.stopTransientMessageTimer()
    engine.reset()
    _handlers.syncState()
    state.status = 'ready'
    state.particles = []
    state.transientMessage = ''
    state.stageShake = false
    state.waitingOverlayVisible = true
    state.resultOverlayVisible = false
    state.readyOverlayVisible = false
    state.rewardMessage = ''
    state.message = '按「開始」後用 ←/→ 或 A/D 移動擋板，空白鍵發球。'
  },
  startGame: () => {
    if (state.status === 'playing' || state.readyOverlayVisible) return
    if (state.status === 'gameover') _actions.resetGame()
    state.waitingOverlayVisible = false
    state.resultOverlayVisible = false
    _handlers.runReadyCountdown(() => {
      state.status = 'playing'
      state.message = '按空白鍵發球！'
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
    state.message = state.launched ? '進行中...' : '按空白鍵發球！'
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
  },
  launchBall: () => {
    if (state.status !== 'playing' || state.launched) return
    engine.launchBall()
    _handlers.syncState()
    state.message = '進行中...'
  }
}

const onBreakoutKeydown = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase()
  if (key === 'arrowleft' || key === 'a') {
    moveLeftHeld = true
    event.preventDefault()
  }
  if (key === 'arrowright' || key === 'd') {
    moveRightHeld = true
    event.preventDefault()
  }
  if (key === ' ') {
    _actions.launchBall()
    event.preventDefault()
  }
}
const onBreakoutKeyup = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase()
  if (key === 'arrowleft' || key === 'a') moveLeftHeld = false
  if (key === 'arrowright' || key === 'd') moveRightHeld = false
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
    window.addEventListener('keydown', onBreakoutKeydown)
    window.addEventListener('keyup', onBreakoutKeyup)
  }
  _actions.resetGame()
  state.waitingOverlayVisible = true
})

onBeforeUnmount(() => {
  _handlers.stopTickTimer()
  _handlers.stopReadyTimer()
  _handlers.stopShakeTimer()
  _handlers.stopTransientMessageTimer()
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onBreakoutKeydown)
    window.removeEventListener('keyup', onBreakoutKeyup)
  }
})
</script>

<template>
  <main class="brk-page" :class="`state-${state.status}`">
    <div class="brk-overlay" />
    <div v-if="state.waitingOverlayVisible" class="game-mask waiting-mask">
      <div class="mask-title">WELCOME</div>
      <p class="waiting-subtitle">BREAKOUT</p>
      <button class="brk-btn waiting-btn waiting-start" type="button" @click="click.start">START</button>
      <button class="brk-btn link waiting-btn" type="button" @click="click.openRateDialog">CONVERT</button>
      <button class="brk-btn link waiting-btn" type="button" @click="click.openRuleDialog">RULE</button>
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
        <button class="brk-btn" type="button" @click="click.again">AGAIN</button>
        <button class="brk-btn danger" type="button" @click="click.exit">EXIT</button>
      </div>
    </div>

    <GameRateDialog :visible="state.rateDialogOpen" game-key="breakout" game-name="BREAKOUT"
      accent-color="#1de9b6" @close="click.closeRateDialog" />
    <GameRuleDialog :visible="state.ruleDialogOpen" game-name="BREAKOUT" accent-color="#1de9b6"
      v-bind="BREAKOUT_RULE" @close="click.closeRuleDialog" />

    <section class="brk-shell">
      <aside class="brk-side left">
        <button class="brk-btn" type="button" :disabled="!canResumeFromPause" @click="click.resume">START</button>
        <button class="brk-btn" type="button" :disabled="!canPauseWhilePlaying" @click="click.pause">PAUSE</button>
        <button class="brk-btn" type="button" @click="click.replay">REPLAY</button>
        <button class="brk-btn link" type="button" @click="click.end">END</button>
        <button class="brk-btn" type="button" @click="click.openRateDialog">CONVERT</button>
        <button class="brk-btn" type="button" @click="click.openRuleDialog">RULE</button>
      </aside>

      <section class="brk-center">
        <header class="brk-title-wrap">
          <h1 class="brk-title">BREAKOUT</h1>
          <p class="brk-status" :class="statusClass">{{ statusText }}</p>
        </header>

        <div class="brk-frame">
          <div class="brk-stage" :class="{ shake: state.stageShake }">
            <div v-for="b in state.bricks" v-show="b.alive" :key="b.id" class="brk-brick"
              :style="`left:${b.x}px; top:${b.y}px; background:${BRICK_COLORS[b.row % BRICK_COLORS.length]}; box-shadow:0 0 5px ${BRICK_COLORS[b.row % BRICK_COLORS.length]}99;`" />

            <div v-for="p in state.particles" :key="p.id" class="brk-particle" :style="`left:${p.x}px; top:${p.y}px;`" />

            <div class="brk-ball" :style="`left:${state.ballX}px; top:${state.ballY}px;`" />
            <div class="brk-paddle" :style="`left:${state.paddleX}px; top:${PADDLE_Y}px;`" />

            <div v-if="state.transientMessage" class="brk-transient">{{ state.transientMessage }}</div>
          </div>
          <div class="brk-panel">
            <span>SCORE: {{ state.score }}</span>
            <span>LV: {{ state.level }}</span>
            <span>LIVES: {{ '❤'.repeat(Math.max(0, state.lives)) }}</span>
          </div>
        </div>

        <p class="brk-message">{{ state.message }}</p>
      </section>

      <aside class="brk-side right">
        <div class="brk-help-panel">
          <p class="brk-help-title">HOW TO PLAY</p>
          <p class="brk-help-text">←/→ 或 A/D 移動擋板，空白鍵發球；球撞牆/擋板/磚塊會反彈，擊中擋板不同位置影響反彈角度；清光磚塊過關，球掉出底部扣命。</p>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped lang="scss">
.brk-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #04211c, #010605 60%);
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
    background: radial-gradient(circle at 20% 20%, rgba(29, 233, 182, 0.16), transparent 45%),
      radial-gradient(circle at 80% 70%, rgba(140, 255, 230, 0.1), transparent 40%);
    filter: blur(40px);
    animation: ambient-drift 12s ease-in-out infinite alternate;
  }

  &::after {
    background: linear-gradient(115deg, rgba(29, 233, 182, 0.05), rgba(0, 0, 0, 0));
    animation: ambient-pulse 4.6s ease-in-out infinite;
  }

  .brk-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(29, 233, 182, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(29, 233, 182, 0.05) 1px, transparent 1px);
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
      color: #1de9b6;
      font-size: clamp(2rem, 8vw, 4rem);
      letter-spacing: 0.25rem;
      font-weight: 900;
    }

    .mask-count {
      color: #1de9b6;
      font-size: clamp(3rem, 12vw, 7rem);
      font-weight: 900;
      line-height: 1;
    }

    &.waiting-mask {
      background: rgba(0, 0, 0, 0.88);

      .waiting-subtitle {
        margin: 0;
        color: #a9ffea;
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
        border: 1px solid rgba(29, 233, 182, 0.4);
        background: rgba(4, 40, 32, 0.65);
        color: #d3fff0;
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

  .brk-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, 100%);
    padding: 24px;
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    gap: 20px;
    align-items: center;
  }

  .brk-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .brk-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(29, 233, 182, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    background: rgba(4, 30, 24, 0.75);
    color: #1de9b6;
    font-weight: 700;
    letter-spacing: 0.5px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(190, 255, 240, 0.25) 50%, transparent 65%);
      transform: translateX(-150%);
      transition: transform 0.35s ease;
      pointer-events: none;
    }

    &:hover {
      border-color: #1de9b6;
      box-shadow: 0 0 12px rgba(29, 233, 182, 0.35);
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

  .brk-center {
    text-align: center;

    .brk-title-wrap {
      margin-bottom: 8px;
    }

    .brk-title {
      margin: 0;
      color: #1de9b6;
      font-size: clamp(1.5rem, 4.4vw, 2.6rem);
      letter-spacing: 0.1rem;
      font-weight: 900;
      text-shadow: 0 0 14px rgba(29, 233, 182, 0.5);
      animation: title-float 2.6s ease-in-out infinite;
    }

    .brk-status {
      margin: 2px 0 0;
      color: #d3fff0;
      font-size: 0.9rem;
      letter-spacing: 0.2rem;

      &.is-playing {
        color: #1de9b6;
      }

      &.is-pause {
        color: #ffcc33;
      }

      &.is-gameover {
        color: #ff5e5e;
      }
    }

    .brk-frame {
      width: fit-content;
      margin: 12px auto 0;
      padding: 12px;
      background: #041e18;
      border: 10px solid #103c33;
      border-radius: 18px;
      box-shadow: 0 0 0 1px rgba(29, 233, 182, 0.2), 0 0 24px rgba(29, 233, 182, 0.16);
      animation: frame-glow 5.4s ease-in-out infinite;
    }

    .brk-stage {
      box-sizing: content-box;
      position: relative;
      width: 400px;
      height: 460px;
      background: #010b09;
      border: 2px solid #000;
      border-radius: 8px;
      overflow: hidden;

      &.shake {
        animation: stage-shake 260ms ease-out;
      }

      .brk-brick {
        position: absolute;
        width: 32px;
        height: 14px;
        border-radius: 2px;
      }

      .brk-particle {
        position: absolute;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #fff2b0;
        pointer-events: none;
        animation: explosion-burst 0.4s ease-out both;
      }

      .brk-ball {
        position: absolute;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
      }

      .brk-paddle {
        position: absolute;
        width: 70px;
        height: 12px;
        border-radius: 4px;
        background: #1de9b6;
        box-shadow: 0 0 10px rgba(29, 233, 182, 0.7);
      }

      .brk-transient {
        position: absolute;
        top: 45%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-family: 'Press Start 2P', monospace;
        font-size: 14px;
        color: #ffe066;
        text-shadow: 0 0 10px rgba(255, 224, 102, 0.8);
        letter-spacing: 0.1em;
        pointer-events: none;
        animation: subtle-fade 0.9s ease-in-out both;
      }
    }

    .brk-panel {
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      color: #1de9b6;
      font-weight: 800;
      text-shadow: 0 0 6px rgba(29, 233, 182, 0.45);
    }

    .brk-message {
      margin-top: 14px;
      color: #d3fff0;
      font-size: 0.85rem;
      animation: subtle-fade 2.8s ease-in-out infinite;
    }
  }

  .brk-help-panel {
    border: 1px solid rgba(29, 233, 182, 0.3);
    border-radius: 8px;
    padding: 12px;
    background: rgba(4, 30, 24, 0.5);

    .brk-help-title {
      margin: 0 0 6px;
      color: #1de9b6;
      font-size: 0.75rem;
      letter-spacing: 0.14rem;
      font-weight: 800;
    }

    .brk-help-text {
      margin: 0;
      color: #d3fff0;
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
    box-shadow: 0 0 0 1px rgba(29, 233, 182, 0.2), 0 0 24px rgba(29, 233, 182, 0.16);
  }

  50% {
    box-shadow: 0 0 0 1px rgba(160, 255, 230, 0.35), 0 0 40px rgba(29, 233, 182, 0.3);
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
  }

  100% {
    opacity: 0;
    transform: scale(2.4);
  }
}

@media (max-width: 980px) {
  .brk-page {
    .brk-shell {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .brk-side {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
